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
const { createRequester, buildPath, buildQuery } = require('../lib/request.js')
const {
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError
} = require('../lib/errors.js')
const { reply, mockFetch, rejects } = require('./helpers')

const KEY = 'test-key'

test('buildPath encodes each segment under /api/v1', (t) => {
  t.is(buildPath(['health']), '/api/v1/health')
  t.is(buildPath(['wallets', 'a/b c?#']), '/api/v1/wallets/a%2Fb%20c%3F%23')
})

test('buildQuery encodes values and omits undefined', (t) => {
  t.is(buildQuery(undefined), '')
  t.is(buildQuery({}), '')
  t.is(buildQuery({ a: undefined }), '')
  t.is(buildQuery({ limit: 10, skip: 0, to: undefined, from: '2025-01-01T00:00:00+01:00' }),
    '?limit=10&skip=0&from=2025-01-01T00%3A00%3A00%2B01%3A00')
  t.is(buildQuery({ 'a b': 'x&y=z' }), '?a%20b=x%26y%3Dz')
})

test('builds URL from baseUrl (trailing slash stripped), path and query', async (t) => {
  const fetch = mockFetch()
  const request = createRequester({ baseUrl: 'https://example.test//', apiKey: KEY, fetch })
  await request('GET', ['ethereum', 'usdt', '0x a/b', 'token-transfers'], { query: { limit: 5, fromTs: undefined } })
  t.is(fetch.calls[0].url, 'https://example.test/api/v1/ethereum/usdt/0x%20a%2Fb/token-transfers?limit=5')
  t.is(fetch.calls[0].method, 'GET')
})

test('defaults to the public base URL', async (t) => {
  const fetch = mockFetch()
  await createRequester({ fetch })('GET', ['chains'], { auth: false })
  t.is(fetch.calls[0].url, 'https://wdk-api.tether.su/api/v1/chains')
})

test('unauthenticated request without key sends only Accept', async (t) => {
  const fetch = mockFetch()
  await createRequester({ fetch })('GET', ['health'], { auth: false })
  t.alike(fetch.calls[0].headers, { Accept: 'application/json' })
  t.absent('body' in fetch.calls[0])
})

test('unauthenticated request never sends the key, even when configured', async (t) => {
  const fetch = mockFetch()
  await createRequester({ apiKey: KEY, fetch })('GET', ['chains'], { auth: false })
  t.alike(fetch.calls[0].headers, { Accept: 'application/json' })
})

test('authenticated request sends X-API-KEY', async (t) => {
  const fetch = mockFetch()
  await createRequester({ apiKey: KEY, fetch })('GET', ['wallets'])
  t.alike(fetch.calls[0].headers, { Accept: 'application/json', 'X-API-KEY': KEY })
})

test('authenticated request without key rejects before fetching', async (t) => {
  const fetch = mockFetch()
  const request = createRequester({ fetch })
  await rejects(t, request('GET', ['wallets']), WdkIndexerValidationError, /^API key is required$/)
  t.is(fetch.calls.length, 0)
})

test('body is JSON-encoded with Content-Type', async (t) => {
  const fetch = mockFetch()
  const body = [{ blockchain: 'ethereum', token: 'usdt', address: '0xabc' }]
  await createRequester({ apiKey: KEY, fetch })('POST', ['batch', 'token-balances'], { body })
  const call = fetch.calls[0]
  t.is(call.method, 'POST')
  t.is(call.body, JSON.stringify(body))
  t.alike(call.headers, { Accept: 'application/json', 'X-API-KEY': KEY, 'Content-Type': 'application/json' })
})

test('2xx JSON body is returned unchanged', async (t) => {
  const payload = { transfers: [{ amount: '1.5', ts: 1 }], extra: { nested: true } }
  const fetch = mockFetch(() => reply(200, payload))
  t.alike(await createRequester({ apiKey: KEY, fetch })('GET', ['wallets']), payload)
})

test('2xx empty body resolves to null', async (t) => {
  const fetch = mockFetch(() => reply(204))
  t.is(await createRequester({ apiKey: KEY, fetch })('DELETE', ['wallets', 'w1']), null)
})

test('2xx non-JSON body rejects with WdkIndexerError', async (t) => {
  const fetch = mockFetch(() => reply(200, 'not json'))
  const err = await rejects(t, createRequester({ apiKey: KEY, fetch })('GET', ['wallets']),
    WdkIndexerError, /^Invalid JSON in response \(HTTP 200\)$/)
  t.absent(err instanceof WdkIndexerApiError)
})

test('API error JSON maps to WdkIndexerApiError', async (t) => {
  const body = { error: 'Bad Request', message: 'Invalid blockchain', status: 400 }
  const fetch = mockFetch(() => reply(400, body, 'Bad Request'))
  const err = await rejects(t, createRequester({ apiKey: KEY, fetch })('GET', ['plasma', 'usdt', '0x', 'token-balances']),
    WdkIndexerApiError, /^Invalid blockchain$/)
  t.is(err.status, 400)
  t.is(err.errorType, 'Bad Request')
  t.alike(err.body, body)
})

test('non-JSON and empty error bodies use the status line', async (t) => {
  const html = mockFetch(() => reply(502, '<html>bad gateway</html>', 'Bad Gateway'))
  const raw = await rejects(t, createRequester({ apiKey: KEY, fetch: html })('GET', ['wallets']),
    WdkIndexerApiError, /^HTTP 502 Bad Gateway$/)
  t.is(raw.status, 502)
  t.is(raw.errorType, null)
  t.is(raw.body, '<html>bad gateway</html>')

  const empty = mockFetch(() => reply(500, undefined, 'Internal Server Error'))
  const err = await rejects(t, createRequester({ apiKey: KEY, fetch: empty })('GET', ['wallets']),
    WdkIndexerApiError, /^HTTP 500 Internal Server Error$/)
  t.is(err.status, 500)
  t.is(err.errorType, null)
  t.is(err.body, null)
})

test('okStatuses treats extra statuses as success', async (t) => {
  const body = { status: 'unhealthy', timestamp: '2025-01-01T00:00:00.000Z' }
  const fetch = mockFetch(() => reply(503, body, 'Service Unavailable'))
  const request = createRequester({ fetch })
  t.alike(await request('GET', ['health'], { auth: false, okStatuses: [503] }), body)
  await rejects(t, request('GET', ['health'], { auth: false }), WdkIndexerApiError, /^HTTP 503 Service Unavailable$/)
})

test('okStatuses only succeed with a JSON body', async (t) => {
  const html = mockFetch(() => reply(503, '<html>503</html>', 'Service Unavailable'))
  const raw = await rejects(t, createRequester({ fetch: html })('GET', ['health'], { auth: false, okStatuses: [503] }),
    WdkIndexerApiError, /^HTTP 503 Service Unavailable$/)
  t.is(raw.status, 503)
  t.is(raw.body, '<html>503</html>')

  const empty = mockFetch(() => reply(503, undefined, 'Service Unavailable'))
  const err = await rejects(t, createRequester({ fetch: empty })('GET', ['health'], { auth: false, okStatuses: [503] }),
    WdkIndexerApiError, /^HTTP 503 Service Unavailable$/)
  t.is(err.status, 503)
  t.is(err.body, null)
})

test('fetch rejection maps to WdkIndexerNetworkError with cause', async (t) => {
  const cause = new Error('ECONNREFUSED')
  const fetch = async () => { throw cause }
  const err = await rejects(t, createRequester({ apiKey: KEY, fetch })('GET', ['wallets']),
    WdkIndexerNetworkError, /^Network request failed: ECONNREFUSED$/)
  t.is(err.cause, cause)
})

test('body read failure maps to WdkIndexerNetworkError', async (t) => {
  const cause = new Error('socket hang up')
  const fetch = async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => { throw cause } })
  const err = await rejects(t, createRequester({ apiKey: KEY, fetch })('GET', ['wallets']),
    WdkIndexerNetworkError, /socket hang up/)
  t.is(err.cause, cause)
})

test('never-resolving fetch rejects with WdkIndexerTimeoutError', async (t) => {
  const fetch = () => new Promise(() => {})
  const started = Date.now()
  const err = await rejects(t, createRequester({ apiKey: KEY, timeout: 30, fetch })('GET', ['wallets']),
    WdkIndexerTimeoutError, /^Request timed out after 30ms$/)
  t.is(err.timeout, 30)
  t.ok(Date.now() - started < 1000, 'rejects promptly')
})

// Swap a global for the duration of one test.
function swapGlobal (t, name, value) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name)
  const original = globalThis[name]
  globalThis[name] = value
  t.teardown(() => {
    if (had) globalThis[name] = original
    else delete globalThis[name]
  })
}

// Spy on setTimeout/clearTimeout; returns the { id, ms } of every timer armed.
function spyTimers (t) {
  const realSet = globalThis.setTimeout
  const realClear = globalThis.clearTimeout
  const timers = []
  const cleared = new Set()
  swapGlobal(t, 'setTimeout', (fn, ms) => {
    const id = realSet(fn, ms)
    timers.push({ id, ms })
    return id
  })
  swapGlobal(t, 'clearTimeout', (id) => {
    cleared.add(id)
    realClear(id)
  })
  const last = (ms) => timers.filter((timer) => timer.ms === ms).pop()
  return { timers, cleared, last }
}

test('timer is cleared after success, error and timeout', async (t) => {
  const spy = spyTimers(t)

  await createRequester({ apiKey: KEY, timeout: 4001, fetch: mockFetch() })('GET', ['wallets'])
  t.ok(spy.cleared.has(spy.last(4001).id), 'cleared after success')

  await createRequester({ apiKey: KEY, timeout: 4002, fetch: async () => { throw new Error('x') } })('GET', ['wallets']).catch(() => {})
  t.ok(spy.cleared.has(spy.last(4002).id), 'cleared after network error')

  await createRequester({ apiKey: KEY, timeout: 10, fetch: () => new Promise(() => {}) })('GET', ['wallets']).catch(() => {})
  t.ok(spy.cleared.has(spy.last(10).id), 'cleared after timeout')
  t.is(spy.timers.filter((timer) => timer.ms === 10).length, 1, 'one timer per request')
})

test('timeout defaults to 30000ms', async (t) => {
  const spy = spyTimers(t)
  await createRequester({ fetch: mockFetch() })('GET', ['chains'], { auth: false })
  t.ok(spy.last(30000), 'timer armed with 30000ms')
})

// Stand-in for runtimes without AbortController (Bare).
class FakeAbortController {
  constructor () {
    const listeners = []
    this.signal = { aborted: false, addEventListener: (type, fn) => listeners.push(fn) }
    this.listeners = listeners
  }

  abort () {
    this.signal.aborted = true
    for (const fn of this.listeners) fn()
  }
}

test('passes a signal and aborts it on timeout when AbortController exists', async (t) => {
  if (typeof globalThis.AbortController !== 'function') swapGlobal(t, 'AbortController', FakeAbortController)
  const fetch = mockFetch(() => new Promise(() => {}))
  await rejects(t, createRequester({ apiKey: KEY, timeout: 10, fetch })('GET', ['wallets']), WdkIndexerTimeoutError, /timed out/)
  const { signal } = fetch.calls[0]
  t.ok(signal, 'signal passed')
  t.is(signal.aborted, true, 'signal aborted')
})

test('a fetch that rejects on abort still gives WdkIndexerTimeoutError', async (t) => {
  if (typeof globalThis.AbortController !== 'function') swapGlobal(t, 'AbortController', FakeAbortController)
  const fetch = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const err = new Error('This operation was aborted')
      err.name = 'AbortError'
      reject(err)
    })
  })
  const err = await rejects(t, createRequester({ apiKey: KEY, timeout: 10, fetch })('GET', ['wallets']),
    WdkIndexerTimeoutError, /^Request timed out after 10ms$/)
  t.is(err.timeout, 10)
  // Let the aborted fetch settle; an unhandled rejection would fail the run.
  await new Promise((resolve) => setTimeout(resolve, 20))
})

test('passes no signal when AbortController is absent', async (t) => {
  swapGlobal(t, 'AbortController', undefined)
  const fetch = mockFetch()
  await createRequester({ apiKey: KEY, fetch })('GET', ['wallets'])
  t.absent('signal' in fetch.calls[0])
})

// Local HTTP server that echoes each request as JSON. Works on Node and Bare
// (bare-http1 comes with bare-fetch).
function echoServer (t) {
  const http = typeof Bare !== 'undefined' ? require('bare-http1') : require('http')
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Connection', 'close')
      res.end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers, body }))
    })
  })
  t.teardown(() => new Promise((resolve) => server.close(resolve)))
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port))
  })
}

test('default fetch (#fetch) reaches a real server on this runtime', async (t) => {
  const baseUrl = await echoServer(t)
  const request = createRequester({ baseUrl, apiKey: KEY })

  const got = await request('GET', ['chains'], { auth: false, query: { a: 1 } })
  t.is(got.method, 'GET')
  t.is(got.url, '/api/v1/chains?a=1')
  t.is(got.headers.accept, 'application/json')
  t.absent('x-api-key' in got.headers)

  const body = [{ blockchain: 'ethereum', token: 'usdt', address: '0xabc', limit: 5 }]
  const posted = await request('POST', ['batch', 'token-transfers'], { body })
  t.is(posted.method, 'POST')
  t.is(posted.headers['x-api-key'], KEY)
  t.is(posted.headers['content-type'], 'application/json')
  t.alike(JSON.parse(posted.body), body, 'POST body arrives intact')
})
