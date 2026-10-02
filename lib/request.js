// Copyright 2025 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict'

const defaultFetch = require('#fetch')
const { DEFAULT_BASE_URL, DEFAULT_TIMEOUT } = require('./constants.js')
const {
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError
} = require('./errors.js')

const API_PREFIX = '/api/v1'

/** '/api/v1/a/b' from ['a', 'b'], each segment URI-encoded. */
function buildPath (segments) {
  return API_PREFIX + segments.map((s) => '/' + encodeURIComponent(s)).join('')
}

/** '?a=1&b=2' from { a: 1, b: 2 }; undefined values are omitted. */
function buildQuery (query) {
  const parts = []
  for (const key of Object.keys(query || {})) {
    if (query[key] !== undefined) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(query[key])))
    }
  }
  return parts.length === 0 ? '' : '?' + parts.join('&')
}

function parseBody (text) {
  if (!text) return { value: null }
  try {
    return { value: JSON.parse(text) }
  } catch {
    return { value: text, invalid: true }
  }
}

async function send (fetch, url, init) {
  try {
    const response = await fetch(url, init)
    const text = await response.text()
    return { response, text }
  } catch (err) {
    throw new WdkIndexerNetworkError(err)
  }
}

/**
 * Create a request function bound to one client configuration.
 * @param {{ baseUrl?: string, apiKey?: string, timeout?: number, fetch?: Function }} [config]
 * @returns {(method: string, path: string[], opts?: { query?: object, body?: *, auth?: boolean, okStatuses?: number[] }) => Promise<*>}
 */
function createRequester ({ baseUrl = DEFAULT_BASE_URL, apiKey, timeout = DEFAULT_TIMEOUT, fetch = defaultFetch } = {}) {
  const origin = baseUrl.replace(/\/+$/, '')

  return async function request (method, path, { query, body, auth = true, okStatuses = [] } = {}) {
    if (auth && !apiKey) throw new WdkIndexerValidationError('API key is required')

    const headers = { Accept: 'application/json' }
    if (auth) headers['X-API-KEY'] = apiKey
    const init = { method, headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    // Bare has no AbortController; there the timeout only stops waiting.
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null
    if (controller) init.signal = controller.signal

    let timer
    const timedOut = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new WdkIndexerTimeoutError(timeout))
        if (controller) controller.abort()
      }, timeout)
    })

    let result
    try {
      result = await Promise.race([send(fetch, origin + buildPath(path) + buildQuery(query), init), timedOut])
    } finally {
      clearTimeout(timer)
    }

    const { response, text } = result
    const { value, invalid } = parseBody(text)
    if (response.ok) {
      if (invalid) throw new WdkIndexerError('Invalid JSON in response (HTTP ' + response.status + ')')
      return value
    }
    // An extra "ok" status (health 503) only counts when it carries a JSON body;
    // an empty or HTML 503 from a proxy is a plain API error.
    if (okStatuses.includes(response.status) && !invalid && value !== null) return value
    throw new WdkIndexerApiError(response.status, response.statusText, value)
  }
}

module.exports = { createRequester, buildPath, buildQuery }
