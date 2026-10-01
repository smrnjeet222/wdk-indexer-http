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

test('assertString: non-empty string with optional max length', (t) => {
  t.execution(() => v.assertString('ethereum', 'blockchain'))
  t.execution(() => v.assertString('x'.repeat(255), 'txHash', 255))
  throws(t, () => v.assertString('', 'blockchain'), /^blockchain must be a non-empty string$/)
  throws(t, () => v.assertString(undefined, 'token'), /^token must be a non-empty string$/)
  throws(t, () => v.assertString(42, 'address'), /^address must be a non-empty string$/)
  throws(t, () => v.assertString('x'.repeat(256), 'txHash', 255), /^txHash must be at most 255 characters$/)
})

test('assertString counts max length in code points', (t) => {
  const emoji = '\u{1F600}'
  t.execution(() => v.assertString(emoji.repeat(60), 'name', 100), '60 emoji = 120 UTF-16 units, still allowed')
  t.execution(() => v.assertString(emoji.repeat(100), 'name', 100))
  throws(t, () => v.assertString(emoji.repeat(101), 'name', 100), /^name must be at most 100 characters$/)
})

test('assertSegment rejects dot segments', (t) => {
  t.execution(() => v.assertSegment('w1', 'walletId'))
  t.execution(() => v.assertSegment('...', 'walletId'))
  t.execution(() => v.assertSegment('a.b', 'walletId'))
  throws(t, () => v.assertSegment('.', 'walletId'), /^walletId must not be '\.' or '\.\.'$/)
  throws(t, () => v.assertSegment('..', 'address'), /^address must not be/)
  throws(t, () => v.assertSegment('', 'walletId'), /^walletId must be a non-empty string$/)
  throws(t, () => v.assertSegment('x'.repeat(256), 'txHash', 255), /^txHash must be at most 255 characters$/)
})

test('assertAddressPath checks blockchain, token and address', (t) => {
  t.execution(() => v.assertAddressPath('ethereum', 'usdt', '0xabc'))
  throws(t, () => v.assertAddressPath('', 'usdt', '0xabc'), /^blockchain must be a non-empty string$/)
  throws(t, () => v.assertAddressPath('ethereum', '.', '0xabc'), /^token must not be/)
  throws(t, () => v.assertAddressPath('ethereum', 'usdt', null), /^address must be a non-empty string$/)
})

test('assertString does not check chain or token lists', (t) => {
  t.execution(() => v.assertString('plasma', 'blockchain'))
  t.execution(() => v.assertString('dai', 'token'))
})

test('assertInteger: bounds, optional', (t) => {
  t.execution(() => v.assertInteger(undefined, 'limit', 1, 1000))
  t.execution(() => v.assertInteger(1, 'limit', 1, 1000))
  t.execution(() => v.assertInteger(1000, 'limit', 1, 1000))
  t.execution(() => v.assertInteger(0, 'skip', 0))
  throws(t, () => v.assertInteger(0, 'limit', 1, 1000), /^limit must be an integer from 1 to 1000$/)
  throws(t, () => v.assertInteger(1001, 'limit', 1, 1000), /limit/)
  throws(t, () => v.assertInteger(1.5, 'limit', 1, 1000), /limit/)
  throws(t, () => v.assertInteger('10', 'limit', 1, 1000), /limit/)
  throws(t, () => v.assertInteger(-1, 'skip', 0), /^skip must be an integer >= 0$/)
})

test('assertOneOf', (t) => {
  t.execution(() => v.assertOneOf(undefined, 'sort', ['asc', 'desc']))
  t.execution(() => v.assertOneOf('asc', 'sort', ['asc', 'desc']))
  throws(t, () => v.assertOneOf('up', 'sort', ['asc', 'desc']), /^sort must be one of: asc, desc$/)
})

test('assertOptions: undefined or plain object', (t) => {
  t.execution(() => v.assertOptions(undefined, 'options'))
  t.execution(() => v.assertOptions({}, 'options'))
  throws(t, () => v.assertOptions(null, 'options'), /^options must be an object$/)
  throws(t, () => v.assertOptions([], 'options'), /options/)
  throws(t, () => v.assertOptions(10, 'options'), /options/)
})

test('assertBatch: 1..10 items', (t) => {
  t.execution(() => v.assertBatch([item]))
  t.execution(() => v.assertBatch(many(10, item)))
  throws(t, () => v.assertBatch([]), /^requests must be an array of 1 to 10 items$/)
  throws(t, () => v.assertBatch(many(11, item)), /1 to 10/)
  throws(t, () => v.assertBatch(item), /requests must be an array/)
  throws(t, () => v.assertBatch(undefined), /requests must be an array/)
})

test('assertBatch: each item shape, error names the index', (t) => {
  t.execution(() => v.assertBatch([{ ...item, blockchain: 'plasma', token: 'dai' }]), 'unknown chain/token accepted')
  throws(t, () => v.assertBatch([item, null]), /^requests\[1\] must be an object$/)
  throws(t, () => v.assertBatch([item, ['x']]), /^requests\[1\] must be an object$/)
  throws(t, () => v.assertBatch([{ ...item, blockchain: '' }]), /^requests\[0\]\.blockchain must be a non-empty string$/)
  throws(t, () => v.assertBatch([item, item, { ...item, token: undefined }]), /^requests\[2\]\.token must be/)
  throws(t, () => v.assertBatch([{ ...item, address: 5 }]), /^requests\[0\]\.address must be/)
})

test('assertWallets: 1..10 objects with non-empty addresses', (t) => {
  const wallet = { type: 'client_wallet', addresses: { ethereum: '0xabc' } }
  t.execution(() => v.assertWallets([wallet]))
  t.execution(() => v.assertWallets(many(10, wallet)))
  t.execution(() => v.assertWallets([{ addresses: { plasma: 'x' } }]), 'unknown chain accepted')
  throws(t, () => v.assertWallets([]), /^wallets must be an array of 1 to 10 items$/)
  throws(t, () => v.assertWallets(many(11, wallet)), /1 to 10/)
  throws(t, () => v.assertWallets(wallet), /wallets must be an array/)
  throws(t, () => v.assertWallets([wallet, 'x']), /^wallets\[1\] must be an object$/)
  throws(t, () => v.assertWallets([{}]), /^wallets\[0\]\.addresses must be a non-empty object$/)
  throws(t, () => v.assertWallets([{ addresses: {} }]), /^wallets\[0\]\.addresses must be a non-empty object$/)
  throws(t, () => v.assertWallets([{ addresses: ['0xabc'] }]), /addresses must be a non-empty object/)
  throws(t, () => v.assertWallets([[]]), /^wallets\[0\] must be an object$/)
  throws(t, () => v.assertWallets([['0xabc']]), /^wallets\[0\] must be an object$/)
})

test('assertWalletPatch: name and/or enabled only', (t) => {
  t.execution(() => v.assertWalletPatch({ name: 'Main' }))
  t.execution(() => v.assertWalletPatch({ name: 'x'.repeat(100) }))
  t.execution(() => v.assertWalletPatch({ enabled: false }))
  t.execution(() => v.assertWalletPatch({ name: 'Main', enabled: true }))
  throws(t, () => v.assertWalletPatch(undefined), /^patch must be an object$/)
  throws(t, () => v.assertWalletPatch({}), /^patch must set name or enabled$/)
  throws(t, () => v.assertWalletPatch({ name: '' }), /^patch\.name must be a non-empty string$/)
  throws(t, () => v.assertWalletPatch({ name: 'x'.repeat(101) }), /^patch\.name must be at most 100 characters$/)
  throws(t, () => v.assertWalletPatch({ enabled: 'yes' }), /^patch\.enabled must be a boolean$/)
  throws(t, () => v.assertWalletPatch({ enabled: 0 }), /^patch\.enabled must be a boolean$/)
  throws(t, () => v.assertWalletPatch({ enabled: '' }), /^patch\.enabled must be a boolean$/)
  throws(t, () => v.assertWalletPatch({ enabled: null }), /^patch\.enabled must be a boolean$/)
  throws(t, () => v.assertWalletPatch({ name: null }), /^patch\.name must be a non-empty string$/)
  throws(t, () => v.assertWalletPatch({ name: 'a', type: 'x' }), /^patch has unknown field: type$/)
})

test('assertTokenTransferOptions: limit 1..1000, fromTs/toTs >= 0', (t) => {
  t.execution(() => v.assertTokenTransferOptions(undefined))
  t.execution(() => v.assertTokenTransferOptions({}))
  t.execution(() => v.assertTokenTransferOptions({ limit: 1000, fromTs: 0, toTs: 1700000000000 }))
  throws(t, () => v.assertTokenTransferOptions(null), /^options must be an object$/)
  throws(t, () => v.assertTokenTransferOptions({ limit: 0 }), /^options\.limit must be an integer from 1 to 1000$/)
  throws(t, () => v.assertTokenTransferOptions({ limit: 1001 }), /options\.limit/)
  throws(t, () => v.assertTokenTransferOptions({ fromTs: -1 }), /^options\.fromTs must be an integer >= 0$/)
  throws(t, () => v.assertTokenTransferOptions({ toTs: 1.5 }), /^options\.toTs must be an integer >= 0$/)
})

test('assertTimeBound: integer >= 0 or non-empty string', (t) => {
  t.execution(() => v.assertTimeBound(undefined, 'from'))
  t.execution(() => v.assertTimeBound(0, 'from'))
  t.execution(() => v.assertTimeBound('2025-01-01T00:00:00Z', 'from'))
  throws(t, () => v.assertTimeBound(-1, 'from'), /^from must be an integer >= 0 or a non-empty string$/)
  throws(t, () => v.assertTimeBound(1.5, 'to'), /^to must be/)
  throws(t, () => v.assertTimeBound('', 'to'), /^to must be/)
  throws(t, () => v.assertTimeBound(null, 'to'), /^to must be/)
})

test('assertTransferFilters: every filter', (t) => {
  t.execution(() => v.assertTransferFilters(undefined))
  t.execution(() => v.assertTransferFilters({}))
  t.execution(() => v.assertTransferFilters({
    blockchain: 'plasma',
    token: 'dai',
    type: 'received',
    from: 0,
    to: '2025-01-01',
    limit: 100,
    skip: 0,
    sort: 'asc'
  }))
  t.execution(() => v.assertTransferFilters({ type: 'sent', limit: 1, sort: 'desc' }))
  throws(t, () => v.assertTransferFilters('x'), /^filters must be an object$/)
  throws(t, () => v.assertTransferFilters({ blockchain: '' }), /^filters\.blockchain must be a non-empty string$/)
  throws(t, () => v.assertTransferFilters({ token: 1 }), /^filters\.token must be a non-empty string$/)
  throws(t, () => v.assertTransferFilters({ type: 'both' }), /^filters\.type must be one of: sent, received$/)
  throws(t, () => v.assertTransferFilters({ from: -5 }), /^filters\.from must be/)
  throws(t, () => v.assertTransferFilters({ to: '' }), /^filters\.to must be/)
  throws(t, () => v.assertTransferFilters({ limit: 0 }), /^filters\.limit must be an integer from 1 to 100$/)
  throws(t, () => v.assertTransferFilters({ limit: 101 }), /filters\.limit/)
  throws(t, () => v.assertTransferFilters({ skip: -1 }), /^filters\.skip must be an integer >= 0$/)
  throws(t, () => v.assertTransferFilters({ sort: 'newest' }), /^filters\.sort must be one of: asc, desc$/)
})
