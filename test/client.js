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

const test = require('brittle')
const { WdkIndexerClient } = require('../lib/client.js')
const { WdkIndexerApiError, WdkIndexerTimeoutError } = require('../lib/errors.js')

const KEY = 'test-key'
const BASE = 'https://wdk-api.tether.su/api/v1'

// Minimal stand-in for a fetch Response.
function reply (status, body, statusText = '') {
  const text = body === undefined ? '' : JSON.stringify(body)
  return { ok: status >= 200 && status < 300, status, statusText, text: async () => text }
}

// Mock fetch that records every call and answers with `respond`.
function mockFetch (respond = () => reply(200, { ok: true })) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, ...init })
    return respond(url, init)
  }
  fetch.calls = calls
  return fetch
}

// Await a rejection, check its class and message, and return it.
async function rejects (t, promise, ErrorClass, pattern) {
  try {
    await promise
  } catch (err) {
    t.ok(err instanceof ErrorClass, 'is ' + ErrorClass.name)
    t.ok(pattern.test(err.message), err.message)
    return err
  }
  t.fail('should reject')
  return {}
}

test('health and getChains need no key and never send X-API-KEY', async (t) => {
  for (const apiKey of [undefined, KEY]) {
    const fetch = mockFetch((url) => reply(200, { url }))
    const client = new WdkIndexerClient({ apiKey, fetch })

    t.alike(await client.health(), { url: BASE + '/health' })
    t.alike(await client.getChains(), { url: BASE + '/chains' })
    for (const call of fetch.calls) {
      t.is(call.method, 'GET')
      t.alike(call.headers, { Accept: 'application/json' })
      t.is(call.body, undefined)
    }
  }
})

test('health resolves with the body on 503 (degraded or unhealthy)', async (t) => {
  for (const status of ['degraded', 'unhealthy']) {
    const body = { status, timestamp: '2025-01-01T00:00:00.000Z' }
    const client = new WdkIndexerClient({ fetch: mockFetch(() => reply(503, body, 'Service Unavailable')) })
    t.alike(await client.health(), body, status)
  }
})

test('health rejects a 503 without a JSON body', async (t) => {
  for (const text of ['<html>503</html>', '']) {
    const fetch = async () => ({ ok: false, status: 503, statusText: 'Service Unavailable', text: async () => text })
    const err = await rejects(t, new WdkIndexerClient({ fetch }).health(), WdkIndexerApiError, /^HTTP 503 Service Unavailable$/)
    t.is(err.status, 503)
  }
})

test('health throws on other error statuses', async (t) => {
  const client = new WdkIndexerClient({ fetch: mockFetch(() => reply(500, { error: 'Internal', message: 'boom' })) })
  const err = await rejects(t, client.health(), WdkIndexerApiError, /^boom$/)
  t.is(err.status, 500)
  for (const status of [400, 404, 502]) {
    const other = new WdkIndexerClient({ fetch: mockFetch(() => reply(status, { status: 'unhealthy' }, 'Err')) })
    const e = await rejects(t, other.health(), WdkIndexerApiError, /^HTTP \d+ Err$/)
    t.is(e.status, status)
  }
})

test('getChains throws WdkIndexerApiError on 500', async (t) => {
  const body = { error: 'Internal Server Error', message: 'Failed to load chains' }
  const client = new WdkIndexerClient({ fetch: mockFetch(() => reply(500, body, 'Internal Server Error')) })
  const err = await rejects(t, client.getChains(), WdkIndexerApiError, /^Failed to load chains$/)
  t.is(err.status, 500)
  t.is(err.errorType, 'Internal Server Error')
})

test('getChains throws WdkIndexerApiError on 503', async (t) => {
  const client = new WdkIndexerClient({ fetch: mockFetch(() => reply(503, undefined, 'Service Unavailable')) })
  const err = await rejects(t, client.getChains(), WdkIndexerApiError, /^HTTP 503 Service Unavailable$/)
  t.is(err.status, 503)
})

test('a user-supplied fetch overrides #fetch', async (t) => {
  const original = globalThis.fetch
  let globalCalls = 0
  globalThis.fetch = async () => {
    globalCalls++
    return reply(200, {})
  }
  try {
    const fetch = mockFetch(() => reply(200, { from: 'user' }))
    t.alike(await new WdkIndexerClient({ fetch }).getChains(), { from: 'user' })
    t.is(fetch.calls.length, 1)
    t.is(globalCalls, 0, 'global fetch not used')
  } finally {
    globalThis.fetch = original
  }
})

test('baseUrl trailing slashes are stripped', async (t) => {
  for (const baseUrl of ['http://localhost:3000', 'http://localhost:3000/', 'http://localhost:3000///']) {
    const fetch = mockFetch()
    await new WdkIndexerClient({ baseUrl, fetch }).health()
    t.is(fetch.calls[0].url, 'http://localhost:3000/api/v1/health', baseUrl)
  }
})

test('defaults to the public base URL', async (t) => {
  const fetch = mockFetch()
  await new WdkIndexerClient({ fetch }).getChains()
  t.is(fetch.calls[0].url, 'https://wdk-api.tether.su/api/v1/chains')
})

test('timeout option is passed to requests', async (t) => {
  const client = new WdkIndexerClient({ timeout: 20, fetch: () => new Promise(() => {}) })
  const err = await rejects(t, client.getChains(), WdkIndexerTimeoutError, /^Request timed out after 20ms$/)
  t.is(err.timeout, 20)
})

test('timeout defaults to 30000ms', async (t) => {
  const realSet = globalThis.setTimeout
  const delays = []
  globalThis.setTimeout = (fn, ms) => {
    delays.push(ms)
    return realSet(fn, ms)
  }
  try {
    await new WdkIndexerClient({ fetch: mockFetch() }).getChains()
  } finally {
    globalThis.setTimeout = realSet
  }
  t.ok(delays.includes(30000), 'timer armed with 30000ms')
})
