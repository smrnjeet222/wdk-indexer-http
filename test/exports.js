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

test('require() resolves the package entry', (t) => {
  const api = require('@tetherto/wdk-indexer-http')
  t.is(typeof api.WdkIndexerClient, 'function')
  t.is(api.BATCH_LIMIT, 10)
})

test('require() of the ./bare alias resolves the same module', (t) => {
  t.is(require('@tetherto/wdk-indexer-http/bare'), require('@tetherto/wdk-indexer-http'))
})

test('#fetch resolves to the runtime fetch', (t) => {
  const fetch = require('#fetch')
  t.is(typeof fetch, 'function')
  if (typeof Bare !== 'undefined') t.is(fetch, require('bare-fetch'), 'bare-fetch on Bare')
  else t.is(fetch, require('../lib/fetch.js'), 'global fetch wrapper on Node')
})

const NAMES = [
  'WdkIndexerClient',
  'WdkIndexerError',
  'WdkIndexerApiError',
  'WdkIndexerTimeoutError',
  'WdkIndexerNetworkError',
  'WdkIndexerValidationError',
  'isApiError',
  'BATCH_LIMIT'
]

test('require() exposes exactly the public API', (t) => {
  const api = require('@tetherto/wdk-indexer-http')
  t.alike(Object.keys(api).sort(), NAMES.slice().sort())
  t.absent(api.createClient, 'createClient is removed')
  t.is(api.WdkIndexerClient, require('../lib/client.js').WdkIndexerClient)
  t.is(api.WdkIndexerApiError, require('../lib/errors.js').WdkIndexerApiError)
})

test('error classes extend WdkIndexerError and Error', (t) => {
  const api = require('@tetherto/wdk-indexer-http')
  const errors = [
    new api.WdkIndexerApiError(404, 'Not Found', null),
    new api.WdkIndexerTimeoutError(10),
    new api.WdkIndexerNetworkError(new Error('down')),
    new api.WdkIndexerValidationError('bad')
  ]
  for (const err of errors) {
    t.ok(err instanceof api.WdkIndexerError, err.name)
    t.ok(err instanceof Error, err.name)
  }
})

test('isApiError is exported and works', (t) => {
  const { isApiError } = require('@tetherto/wdk-indexer-http')
  t.ok(isApiError({ error: 'Bad Request', message: 'nope' }))
  t.absent(isApiError({ transfers: [] }))
})

test('the exported client makes requests', async (t) => {
  const { WdkIndexerClient } = require('@tetherto/wdk-indexer-http')
  const fetch = async (url) => ({ ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify({ url }) })
  const client = new WdkIndexerClient({ fetch })
  t.alike(await client.health(), { url: 'https://wdk-api.tether.su/api/v1/health' })
})
