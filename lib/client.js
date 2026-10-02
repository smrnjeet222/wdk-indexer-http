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

const { createRequester } = require('./request.js')
const { assertSegment, assertAddressPath, assertList } = require('./validate.js')

/** HTTP client for the WDK Indexer API. */
class WdkIndexerClient {
  /**
   * @param {object} [config]
   * @param {string} [config.apiKey] sent as X-API-KEY; required by every method except health() and getChains()
   * @param {string} [config.baseUrl] defaults to https://wdk-api.tether.su
   * @param {number} [config.timeout] request timeout in ms, defaults to 30000
   * @param {Function} [config.fetch] custom fetch implementation
   */
  constructor ({ apiKey, baseUrl, timeout, fetch } = {}) {
    this._request = createRequester({ apiKey, baseUrl, timeout, fetch })
  }

  /** GET /health. Resolves with the JSON body on 200 and on 503 (status 'degraded' or 'unhealthy'). */
  health () {
    return this._request('GET', ['health'], { auth: false, okStatuses: [503] })
  }

  /** GET /chains: supported blockchains and tokens. */
  getChains () {
    return this._request('GET', ['chains'], { auth: false })
  }

  /** GET /{blockchain}/{token}/{address}/token-transfers. */
  async getTokenTransfers (blockchain, token, address, options) {
    assertAddressPath(blockchain, token, address)
    return this._request('GET', [blockchain, token, address, 'token-transfers'], { query: options })
  }

  /** GET /{blockchain}/{token}/{address}/token-balances. */
  async getTokenBalance (blockchain, token, address) {
    assertAddressPath(blockchain, token, address)
    return this._request('GET', [blockchain, token, address, 'token-balances'])
  }

  /** GET /blockchains/{blockchain}/{token}/token-transfers/{txHash}. */
  async getTransactionTransfers (blockchain, token, txHash) {
    assertSegment(blockchain, 'blockchain')
    assertSegment(token, 'token')
    assertSegment(txHash, 'txHash')
    return this._request('GET', ['blockchains', blockchain, token, 'token-transfers', txHash])
  }

  /** POST /batch/token-transfers with 1..10 { blockchain, token, address, limit?, fromTs?, toTs? }. */
  async getBatchTokenTransfers (requests) {
    assertList(requests, 'requests')
    return this._request('POST', ['batch', 'token-transfers'], { body: requests })
  }

  /** POST /batch/token-balances with 1..10 { blockchain, token, address }. */
  async getBatchTokenBalances (requests) {
    assertList(requests, 'requests')
    return this._request('POST', ['batch', 'token-balances'], { body: requests })
  }

  /** POST /wallets with 1..10 wallets, each with an `addresses` object. */
  async registerWallets (wallets) {
    assertList(wallets, 'wallets')
    return this._request('POST', ['wallets'], { body: wallets })
  }

  /** GET /wallets. */
  async listWallets () {
    return this._request('GET', ['wallets'])
  }

  /** GET /wallets/{walletId}. */
  async getWallet (walletId) {
    assertSegment(walletId, 'walletId')
    return this._request('GET', ['wallets', walletId])
  }

  /** PATCH /wallets/{walletId} with { name?, enabled? }. */
  async updateWallet (walletId, patch) {
    assertSegment(walletId, 'walletId')
    return this._request('PATCH', ['wallets', walletId], { body: patch })
  }

  /** DELETE /wallets/{walletId}. */
  async deleteWallet (walletId) {
    assertSegment(walletId, 'walletId')
    return this._request('DELETE', ['wallets', walletId])
  }

  /** GET /wallets/{walletId}/transfers with { blockchain, token, type, from, to, limit, skip, sort }. */
  async getWalletTransfers (walletId, filters) {
    assertSegment(walletId, 'walletId')
    return this._request('GET', ['wallets', walletId, 'transfers'], { query: filters })
  }

  /** GET /transfers across all wallets, same filters as getWalletTransfers(). */
  async getTransfers (filters) {
    return this._request('GET', ['transfers'], { query: filters })
  }
}

module.exports = { WdkIndexerClient }
