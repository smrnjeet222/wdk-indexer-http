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
const { WdkIndexerApiError, WdkIndexerTimeoutError, WdkIndexerValidationError } = require('../lib/errors.js')

const KEY = 'test-key'
const BASE = 'https://wdk-api.tether.su/api/v1'
const ADDR = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
const TX = '0x' + 'ab'.repeat(32)

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

const GET_HEADERS = { Accept: 'application/json', 'X-API-KEY': KEY }
const BODY_HEADERS = { ...GET_HEADERS, 'Content-Type': 'application/json' }

const batch = [
  { blockchain: 'ethereum', token: 'usdt', address: ADDR, limit: 5 },
  { blockchain: 'tron', token: 'usdt', address: 'TXYZ' }
]
const wallets = [{ name: 'main', addresses: { ethereum: ADDR } }]
const tenItems = Array.from({ length: 10 }, (_, i) => ({ blockchain: 'ethereum', token: 'usdt', address: ADDR + i }))
const tenWallets = Array.from({ length: 10 }, (_, i) => ({ type: 'client_wallet', addresses: { ethereum: ADDR + i } }))
const looseBatch = [{ blockchain: 'ethereum', token: 'usdt', address: ADDR, limit: 5000, fromTs: -1, extra: true }]
const EMOJI_NAME = '\u{1F600}'.repeat(60) // 60 code points, 120 UTF-16 units

// [method, args, HTTP method, URL after /api/v1, request body]
const cases = [
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR], 'GET', '/ethereum/usdt/' + ADDR + '/token-transfers'],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { limit: 10, fromTs: 0, toTs: 1700000000 }], 'GET',
    '/ethereum/usdt/' + ADDR + '/token-transfers?limit=10&fromTs=0&toTs=1700000000'],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { toTs: 5, limit: undefined }], 'GET',
    '/ethereum/usdt/' + ADDR + '/token-transfers?toTs=5'],
  ['getTokenBalance', ['ton', 'usdt', 'EQ/a+b'], 'GET', '/ton/usdt/EQ%2Fa%2Bb/token-balances'],
  ['getTransactionTransfers', ['ethereum', 'usdt', TX], 'GET', '/blockchains/ethereum/usdt/token-transfers/' + TX],
  ['getBatchTokenTransfers', [batch], 'POST', '/batch/token-transfers', batch],
  ['getBatchTokenBalances', [batch], 'POST', '/batch/token-balances', batch],
  ['registerWallets', [wallets], 'POST', '/wallets', wallets],
  ['listWallets', [], 'GET', '/wallets'],
  ['getWallet', ['w 1/2'], 'GET', '/wallets/w%201%2F2'],
  ['updateWallet', ['w1', { name: 'renamed' }], 'PATCH', '/wallets/w1', { name: 'renamed' }],
  ['updateWallet', ['w1', { enabled: false }], 'PATCH', '/wallets/w1', { enabled: false }],
  ['deleteWallet', ['w1'], 'DELETE', '/wallets/w1'],
  ['getWalletTransfers', ['w1'], 'GET', '/wallets/w1/transfers'],
  ['getWalletTransfers', ['w1', {
    blockchain: 'ethereum',
    token: 'usdt',
    type: 'sent',
    from: '2025-01-01T00:00:00+01:00',
    to: 1700000000,
    limit: 100,
    skip: 0,
    sort: 'asc'
  }], 'GET', '/wallets/w1/transfers?blockchain=ethereum&token=usdt&type=sent' +
    '&from=2025-01-01T00%3A00%3A00%2B01%3A00&to=1700000000&limit=100&skip=0&sort=asc'],
  ['getTransfers', [], 'GET', '/transfers'],
  ['getTransfers', [{ type: 'received', limit: 1, sort: 'desc', blockchain: undefined }], 'GET',
    '/transfers?type=received&limit=1&sort=desc'],
  // Path segment encoding for every parameter.
  ['getTransactionTransfers', ['eth/x', 'us dt', '0x#1'], 'GET', '/blockchains/eth%2Fx/us%20dt/token-transfers/0x%231'],
  ['getTokenTransfers', ['a?b', 'c&d', 'e f'], 'GET', '/a%3Fb/c%26d/e%20f/token-transfers'],
  ['updateWallet', ['a/b', { enabled: true }], 'PATCH', '/wallets/a%2Fb', { enabled: true }],
  ['deleteWallet', ['a?b'], 'DELETE', '/wallets/a%3Fb'],
  ['getWalletTransfers', ['a b'], 'GET', '/wallets/a%20b/transfers'],
  ['getWallet', ['...'], 'GET', '/wallets/...'],
  // Unknown option keys are not forwarded, and query order is fixed.
  ['getTransfers', [{ limit: 5, foo: 'x', apiKey: 'leak' }], 'GET', '/transfers?limit=5'],
  ['getWalletTransfers', ['w1', { sort: 'asc', blockchain: 'tron', page: 2 }], 'GET', '/wallets/w1/transfers?blockchain=tron&sort=asc'],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { toTs: 9, limit: 5, offset: 3 }], 'GET',
    '/ethereum/usdt/' + ADDR + '/token-transfers?limit=5&toTs=9'],
  // Boundary values are accepted and sent.
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { limit: 1 }], 'GET', '/ethereum/usdt/' + ADDR + '/token-transfers?limit=1'],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { limit: 1000, fromTs: 0 }], 'GET',
    '/ethereum/usdt/' + ADDR + '/token-transfers?limit=1000&fromTs=0'],
  ['getTransactionTransfers', ['ethereum', 'usdt', 'f'.repeat(255)], 'GET', '/blockchains/ethereum/usdt/token-transfers/' + 'f'.repeat(255)],
  ['getWalletTransfers', ['w1', { limit: 100, skip: 0 }], 'GET', '/wallets/w1/transfers?limit=100&skip=0'],
  ['updateWallet', ['w1', { name: 'n'.repeat(100) }], 'PATCH', '/wallets/w1', { name: 'n'.repeat(100) }],
  ['updateWallet', ['w1', { name: EMOJI_NAME }], 'PATCH', '/wallets/w1', { name: EMOJI_NAME }],
  ['getBatchTokenBalances', [tenItems], 'POST', '/batch/token-balances', tenItems],
  ['registerWallets', [tenWallets], 'POST', '/wallets', tenWallets],
  // Shape-only validation: extra keys and missing `type` are left for the server.
  ['getBatchTokenTransfers', [looseBatch], 'POST', '/batch/token-transfers', looseBatch],
  ['registerWallets', [[{ addresses: { plasma: 'x' } }]], 'POST', '/wallets', [{ addresses: { plasma: 'x' } }]]
]

for (const [name, args, method, path, body] of cases) {
  test(name + ' sends ' + method + ' ' + path, async (t) => {
    const result = { name, items: [1, 2, 3] }
    const fetch = mockFetch(() => reply(200, result))
    const client = new WdkIndexerClient({ apiKey: KEY, fetch })

    t.alike(await client[name](...args), result, 'returns the parsed body unchanged')
    t.is(fetch.calls.length, 1)
    const call = fetch.calls[0]
    t.is(call.method, method)
    t.is(call.url, BASE + path)
    t.alike(call.headers, body === undefined ? GET_HEADERS : BODY_HEADERS)
    t.is(call.body, body === undefined ? undefined : JSON.stringify(body))
  })

  test(name + ' requires an API key', async (t) => {
    const fetch = mockFetch()
    await rejects(t, new WdkIndexerClient({ fetch })[name](...args), WdkIndexerValidationError, /^API key is required$/)
    await rejects(t, new WdkIndexerClient({ apiKey: '', fetch })[name](...args), WdkIndexerValidationError, /^API key is required$/)
    t.is(fetch.calls.length, 0, 'fetch not called')
  })
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

test('API errors surface status, errorType and message', async (t) => {
  const body = { error: 'Bad Request', message: 'Unsupported blockchain: plasma' }
  const client = new WdkIndexerClient({ apiKey: KEY, fetch: mockFetch(() => reply(400, body, 'Bad Request')) })
  const err = await rejects(t, client.getTokenBalance('plasma', 'usdt', ADDR), WdkIndexerApiError, /^Unsupported blockchain: plasma$/)
  t.is(err.status, 400)
  t.is(err.errorType, 'Bad Request')
  t.alike(err.body, body)
})

test('unknown chains and tokens are sent to the server', async (t) => {
  const fetch = mockFetch()
  const client = new WdkIndexerClient({ apiKey: KEY, fetch })
  await client.getTokenBalance('plasma', 'doge', ADDR)
  await client.getBatchTokenBalances([{ blockchain: 'plasma', token: 'doge', address: ADDR }])
  t.is(fetch.calls.length, 2)
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

const tooMany = Array.from({ length: 11 }, () => ({ blockchain: 'ethereum', token: 'usdt', address: ADDR }))

// [method, args, message pattern]
const invalid = [
  ['getTokenTransfers', ['', 'usdt', ADDR], /^blockchain must be a non-empty string$/],
  ['getTokenTransfers', ['ethereum', 1, ADDR], /^token must be a non-empty string$/],
  ['getTokenTransfers', ['ethereum', 'usdt', null], /^address must be a non-empty string$/],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, 'x'], /^options must be an object$/],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { limit: 0 }], /^options\.limit must be an integer from 1 to 1000$/],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { limit: 1001 }], /^options\.limit/],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { limit: 1.5 }], /^options\.limit/],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { fromTs: -1 }], /^options\.fromTs must be an integer >= 0$/],
  ['getTokenTransfers', ['ethereum', 'usdt', ADDR, { toTs: '5' }], /^options\.toTs/],
  ['getTokenBalance', ['ethereum', '', ADDR], /^token must be a non-empty string$/],
  ['getTokenBalance', ['ethereum', 'usdt'], /^address must be a non-empty string$/],
  ['getTransactionTransfers', ['ethereum', 'usdt', ''], /^txHash must be a non-empty string$/],
  ['getTransactionTransfers', ['ethereum', 'usdt', 'a'.repeat(256)], /^txHash must be at most 255 characters$/],
  ['getTransactionTransfers', [undefined, 'usdt', TX], /^blockchain must be a non-empty string$/],
  ['getBatchTokenTransfers', [[]], /^requests must be an array of 1 to 10 items$/],
  ['getBatchTokenTransfers', [tooMany], /^requests must be an array of 1 to 10 items$/],
  ['getBatchTokenTransfers', [{}], /^requests must be an array/],
  ['getBatchTokenTransfers', [[null]], /^requests\[0\] must be an object$/],
  ['getBatchTokenBalances', [[batch[0], { blockchain: 'ethereum', address: ADDR }]], /^requests\[1\]\.token must be a non-empty string$/],
  ['getBatchTokenBalances', [undefined], /^requests must be an array/],
  ['registerWallets', [[]], /^wallets must be an array of 1 to 10 items$/],
  ['registerWallets', [Array.from({ length: 11 }, () => wallets[0])], /^wallets must be an array/],
  ['registerWallets', [[{ name: 'x' }]], /^wallets\[0\]\.addresses must be a non-empty object$/],
  ['registerWallets', [[{ addresses: {} }]], /^wallets\[0\]\.addresses must be a non-empty object$/],
  ['getWallet', [''], /^walletId must be a non-empty string$/],
  ['getWallet', [42], /^walletId must be a non-empty string$/],
  ['deleteWallet', [], /^walletId must be a non-empty string$/],
  ['updateWallet', [undefined, { name: 'x' }], /^walletId must be a non-empty string$/],
  ['updateWallet', ['w1'], /^patch must be an object$/],
  ['updateWallet', ['w1', {}], /^patch must set name or enabled$/],
  ['updateWallet', ['w1', { name: 'x', color: 'red' }], /^patch has unknown field: color$/],
  ['updateWallet', ['w1', { name: '' }], /^patch\.name must be a non-empty string$/],
  ['updateWallet', ['w1', { name: 'a'.repeat(101) }], /^patch\.name must be at most 100 characters$/],
  ['updateWallet', ['w1', { enabled: 'yes' }], /^patch\.enabled must be a boolean$/],
  ['getWalletTransfers', ['', {}], /^walletId must be a non-empty string$/],
  ['getWalletTransfers', ['w1', []], /^filters must be an object$/],
  ['getWalletTransfers', ['w1', { limit: 101 }], /^filters\.limit must be an integer from 1 to 100$/],
  ['getWalletTransfers', ['w1', { limit: 0 }], /^filters\.limit/],
  ['getWalletTransfers', ['w1', { skip: -1 }], /^filters\.skip must be an integer >= 0$/],
  ['getWalletTransfers', ['w1', { type: 'both' }], /^filters\.type must be one of: sent, received$/],
  ['getWalletTransfers', ['w1', { sort: 'up' }], /^filters\.sort must be one of: asc, desc$/],
  ['getTransfers', [{ from: '' }], /^filters\.from must be an integer >= 0 or a non-empty string$/],
  ['getTransfers', [{ to: -5 }], /^filters\.to must be an integer >= 0 or a non-empty string$/],
  ['getTransfers', [{ blockchain: '' }], /^filters\.blockchain must be a non-empty string$/],
  ['getTransfers', [{ token: 7 }], /^filters\.token must be a non-empty string$/],
  ['getTransfers', ['ethereum'], /^filters must be an object$/],
  // '.' and '..' would be collapsed by fetch and reach another endpoint.
  ['getWallet', ['..'], /^walletId must not be '\.' or '\.\.'$/],
  ['getWallet', ['.'], /^walletId must not be/],
  ['deleteWallet', ['..'], /^walletId must not be/],
  ['deleteWallet', ['.'], /^walletId must not be/],
  ['updateWallet', ['..', { name: 'x' }], /^walletId must not be/],
  ['getWalletTransfers', ['..'], /^walletId must not be/],
  ['getTokenBalance', ['..', 'usdt', ADDR], /^blockchain must not be/],
  ['getTokenBalance', ['ethereum', '.', ADDR], /^token must not be/],
  ['getTokenTransfers', ['ethereum', 'usdt', '..'], /^address must not be/],
  ['getTransactionTransfers', ['ethereum', 'usdt', '..'], /^txHash must not be/],
  ['updateWallet', ['w1', { name: '\u{1F600}'.repeat(101) }], /^patch\.name must be at most 100 characters$/]
]

for (const [name, args, pattern] of invalid) {
  test(name + ' rejects invalid input: ' + pattern.source, async (t) => {
    const fetch = mockFetch()
    const client = new WdkIndexerClient({ apiKey: KEY, fetch })
    await rejects(t, client[name](...args), WdkIndexerValidationError, pattern)
    t.is(fetch.calls.length, 0, 'fetch not called')
  })
}
