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

// Shape-only argument checks. Chain and token names are never checked
// against a list; the server answers unknown values with a 400.

const { BATCH_LIMIT } = require('./constants.js')
const { WdkIndexerValidationError } = require('./errors.js')

function fail (message) {
  throw new WdkIndexerValidationError(message)
}

function isObject (value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Non-empty string, optionally at most `max` characters (counted as code points, like JSON Schema). */
function assertString (value, name, max) {
  if (typeof value !== 'string' || value.length === 0) fail(name + ' must be a non-empty string')
  if (max !== undefined && [...value].length > max) fail(name + ' must be at most ' + max + ' characters')
}

/** URL path parameter: non-empty string that is not '.' or '..' (fetch would collapse those). */
function assertSegment (value, name, max) {
  assertString(value, name, max)
  if (value === '.' || value === '..') fail(name + " must not be '.' or '..'")
}

/** The {blockchain}/{token}/{address} path parameters. */
function assertAddressPath (blockchain, token, address) {
  assertSegment(blockchain, 'blockchain')
  assertSegment(token, 'token')
  assertSegment(address, 'address')
}

/** Integer in [min, max] (max optional); undefined is allowed. */
function assertInteger (value, name, min, max) {
  if (value === undefined) return
  if (!Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    fail(name + ' must be an integer ' + (max === undefined ? '>= ' + min : 'from ' + min + ' to ' + max))
  }
}

/** One of `values`; undefined is allowed. */
function assertOneOf (value, name, values) {
  if (value !== undefined && !values.includes(value)) fail(name + ' must be one of: ' + values.join(', '))
}

/** Plain object or undefined. */
function assertOptions (value, name) {
  if (value !== undefined && !isObject(value)) fail(name + ' must be an object')
}

/** Array of 1..BATCH_LIMIT items. */
function assertList (value, name) {
  if (!Array.isArray(value) || value.length < 1 || value.length > BATCH_LIMIT) {
    fail(name + ' must be an array of 1 to ' + BATCH_LIMIT + ' items')
  }
}

/** Batch request items: { blockchain, token, address, ... }. */
function assertBatch (requests, name = 'requests') {
  assertList(requests, name)
  requests.forEach((item, i) => {
    const at = name + '[' + i + ']'
    if (!isObject(item)) fail(at + ' must be an object')
    assertString(item.blockchain, at + '.blockchain')
    assertString(item.token, at + '.token')
    assertString(item.address, at + '.address')
  })
}

/** registerWallets items: { addresses: { [chain]: address }, ... }. */
function assertWallets (wallets, name = 'wallets') {
  assertList(wallets, name)
  wallets.forEach((item, i) => {
    const at = name + '[' + i + ']'
    if (!isObject(item)) fail(at + ' must be an object')
    if (!isObject(item.addresses) || Object.keys(item.addresses).length === 0) {
      fail(at + '.addresses must be a non-empty object')
    }
  })
}

/** updateWallet patch: at least one of name / enabled, nothing else. */
function assertWalletPatch (patch, name = 'patch') {
  if (!isObject(patch)) fail(name + ' must be an object')
  for (const key of Object.keys(patch)) {
    if (key !== 'name' && key !== 'enabled') fail(name + ' has unknown field: ' + key)
  }
  if (patch.name === undefined && patch.enabled === undefined) fail(name + ' must set name or enabled')
  if (patch.name !== undefined) assertString(patch.name, name + '.name', 100)
  if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') fail(name + '.enabled must be a boolean')
}

/** getTokenTransfers options: { limit, fromTs, toTs }. */
function assertTokenTransferOptions (options, name = 'options') {
  assertOptions(options, name)
  if (options === undefined) return
  assertInteger(options.limit, name + '.limit', 1, 1000)
  assertInteger(options.fromTs, name + '.fromTs', 0)
  assertInteger(options.toTs, name + '.toTs', 0)
}

/** Time bound for wallet transfers: integer >= 0 or non-empty string. */
function assertTimeBound (value, name) {
  if (value === undefined) return
  if (typeof value === 'string' ? value.length === 0 : !(Number.isInteger(value) && value >= 0)) {
    fail(name + ' must be an integer >= 0 or a non-empty string')
  }
}

/** Wallet transfer filters: { blockchain, token, type, from, to, limit, skip, sort }. */
function assertTransferFilters (filters, name = 'filters') {
  assertOptions(filters, name)
  if (filters === undefined) return
  if (filters.blockchain !== undefined) assertString(filters.blockchain, name + '.blockchain')
  if (filters.token !== undefined) assertString(filters.token, name + '.token')
  assertOneOf(filters.type, name + '.type', ['sent', 'received'])
  assertTimeBound(filters.from, name + '.from')
  assertTimeBound(filters.to, name + '.to')
  assertInteger(filters.limit, name + '.limit', 1, 100)
  assertInteger(filters.skip, name + '.skip', 0)
  assertOneOf(filters.sort, name + '.sort', ['asc', 'desc'])
}

module.exports = {
  assertString,
  assertSegment,
  assertAddressPath,
  assertInteger,
  assertOneOf,
  assertOptions,
  assertBatch,
  assertWallets,
  assertWalletPatch,
  assertTokenTransferOptions,
  assertTimeBound,
  assertTransferFilters
}
