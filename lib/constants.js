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

// Snapshot of GET /api/v1/chains for docs and autocomplete only.
// The client never rejects a request based on these lists.
const BLOCKCHAINS = [
  'ethereum',
  'arbitrum',
  'avalanche',
  'polygon',
  'sepolia',
  'tron',
  'ton',
  'bitcoin',
  'spark'
]

const TOKENS = ['usdt', 'xaut', 'usat', 'btc']

const BATCH_LIMIT = 10

const DEFAULT_BASE_URL = 'https://wdk-api.tether.su'

const DEFAULT_TIMEOUT = 30000

// Query options forwarded to the API; any other keys are dropped.
const TOKEN_TRANSFER_OPTIONS = ['limit', 'fromTs', 'toTs']

const TRANSFER_FILTERS = ['blockchain', 'token', 'type', 'from', 'to', 'limit', 'skip', 'sort']

module.exports = {
  BLOCKCHAINS,
  TOKENS,
  BATCH_LIMIT,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT,
  TOKEN_TRANSFER_OPTIONS,
  TRANSFER_FILTERS
}
