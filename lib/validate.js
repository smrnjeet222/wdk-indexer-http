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

// Only the checks the server cannot do for us. Path parameters must be real
// segments: an empty string, '.' or '..' would make fetch resolve the URL to a
// different endpoint. Batch arrays are capped before a large body is sent.
// Everything else (option ranges, enums, wallet fields, chain and token names)
// is validated by the server, which answers with a 400 naming the field.

const { BATCH_LIMIT } = require('./constants.js')
const { WdkIndexerValidationError } = require('./errors.js')

function fail (message) {
  throw new WdkIndexerValidationError(message)
}

/** URL path parameter: non-empty string that is not '.' or '..'. */
function assertSegment (value, name) {
  if (typeof value !== 'string' || value.length === 0) fail(name + ' must be a non-empty string')
  if (value === '.' || value === '..') fail(name + " must not be '.' or '..'")
}

/** The {blockchain}/{token}/{address} path parameters. */
function assertAddressPath (blockchain, token, address) {
  assertSegment(blockchain, 'blockchain')
  assertSegment(token, 'token')
  assertSegment(address, 'address')
}

/** Array of 1..BATCH_LIMIT items. */
function assertList (value, name) {
  if (!Array.isArray(value) || value.length < 1 || value.length > BATCH_LIMIT) {
    fail(name + ' must be an array of 1 to ' + BATCH_LIMIT + ' items')
  }
}

module.exports = { assertSegment, assertAddressPath, assertList }
