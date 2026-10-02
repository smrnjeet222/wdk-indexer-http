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

test('assertSegment: non-empty string', (t) => {
  t.execution(() => v.assertSegment('w1', 'walletId'))
  t.execution(() => v.assertSegment('a'.repeat(300), 'txHash'), 'length is left to the server')
  throws(t, () => v.assertSegment('', 'walletId'), /^walletId must be a non-empty string$/)
  throws(t, () => v.assertSegment(undefined, 'address'), /^address must be a non-empty string$/)
  throws(t, () => v.assertSegment(42, 'walletId'), /^walletId must be a non-empty string$/)
})

test('assertSegment rejects dot segments', (t) => {
  t.execution(() => v.assertSegment('...', 'walletId'))
  t.execution(() => v.assertSegment('a.b', 'walletId'))
  throws(t, () => v.assertSegment('.', 'walletId'), /^walletId must not be '\.' or '\.\.'$/)
  throws(t, () => v.assertSegment('..', 'address'), /^address must not be/)
})

test('assertSegment does not check chain or token lists', (t) => {
  t.execution(() => v.assertSegment('plasma', 'blockchain'))
  t.execution(() => v.assertSegment('doge', 'token'))
})

test('assertAddressPath checks blockchain, token and address', (t) => {
  t.execution(() => v.assertAddressPath('ethereum', 'usdt', '0xabc'))
  throws(t, () => v.assertAddressPath('', 'usdt', '0xabc'), /^blockchain must be a non-empty string$/)
  throws(t, () => v.assertAddressPath('ethereum', '.', '0xabc'), /^token must not be/)
  throws(t, () => v.assertAddressPath('ethereum', 'usdt', null), /^address must be a non-empty string$/)
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
