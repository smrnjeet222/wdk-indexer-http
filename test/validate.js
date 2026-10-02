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
const { WdkIndexerValidationError } = require('../lib/errors.js')
const v = require('../lib/validate.js')

function throws (t, fn, pattern) {
  try {
    fn()
    t.fail('expected a validation error matching ' + pattern)
  } catch (err) {
    t.ok(err instanceof WdkIndexerValidationError, 'is WdkIndexerValidationError')
    t.ok(pattern.test(err.message), err.message)
  }
}

const item = { blockchain: 'ethereum', token: 'usdt', address: '0xabc' }
const many = (n, x) => Array.from({ length: n }, () => x)

test('assertSegments: each value a non-empty string', (t) => {
  t.execution(() => v.assertSegments({ walletId: 'w1' }))
  t.execution(() => v.assertSegments({ blockchain: 'ethereum', token: 'usdt', address: '0xabc' }))
  t.execution(() => v.assertSegments({ txHash: 'a'.repeat(300) }), 'length is left to the server')
  throws(t, () => v.assertSegments({ walletId: '' }), /^walletId must be a non-empty string$/)
  throws(t, () => v.assertSegments({ blockchain: 'ethereum', token: 'usdt', address: undefined }), /^address must be a non-empty string$/)
  throws(t, () => v.assertSegments({ walletId: 42 }), /^walletId must be a non-empty string$/)
})

test('assertSegments reports the first failing parameter by name', (t) => {
  throws(t, () => v.assertSegments({ blockchain: '', token: '' }), /^blockchain must be a non-empty string$/)
  throws(t, () => v.assertSegments({ blockchain: 'ethereum', token: '.' }), /^token must not be/)
})

test('assertSegments rejects dot segments', (t) => {
  t.execution(() => v.assertSegments({ walletId: '...' }))
  t.execution(() => v.assertSegments({ walletId: 'a.b' }))
  throws(t, () => v.assertSegments({ walletId: '.' }), /^walletId must not be '\.' or '\.\.'$/)
  throws(t, () => v.assertSegments({ address: '..' }), /^address must not be/)
})

test('assertSegments does not check chain or token lists', (t) => {
  t.execution(() => v.assertSegments({ blockchain: 'plasma', token: 'doge' }))
})

test('assertList: 1..10 items, contents left to the server', (t) => {
  t.execution(() => v.assertList([item], 'requests'))
  t.execution(() => v.assertList(many(10, item), 'requests'))
  t.execution(() => v.assertList([null, 'x'], 'requests'), 'items are not inspected')
  throws(t, () => v.assertList([], 'requests'), /^requests must be an array of 1 to 10 items$/)
  throws(t, () => v.assertList(many(11, item), 'wallets'), /^wallets must be an array of 1 to 10 items$/)
  throws(t, () => v.assertList(item, 'requests'), /^requests must be an array/)
  throws(t, () => v.assertList(undefined, 'requests'), /^requests must be an array/)
})
