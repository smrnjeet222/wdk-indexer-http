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
const { assertSegments, assertList } = require('./validate.js')

/**
 * HTTP client for the WDK Indexer API.
 *
 * Every method returns a promise. Besides the errors listed per method, any call
 * can reject with WdkIndexerTimeoutError (no response within `timeout`) or
 * WdkIndexerNetworkError (the request failed before a response arrived).
 */
class WdkIndexerClient {
  /**
   * @param {object} [config]
   * @param {string} [config.apiKey] sent as X-API-KEY; required by every method except health() and getChains()
   * @param {string} [config.baseUrl] defaults to https://wdk-api.tether.su
   * @param {number} [config.timeout] request timeout in ms, defaults to 30000
   * @param {import('../index.js').FetchLike} [config.fetch] custom fetch implementation, used instead of the runtime's
   */
  constructor ({ apiKey, baseUrl, timeout, fetch } = {}) {
    this._request = createRequester({ apiKey, baseUrl, timeout, fetch })
  }

  /**
   * GET /health, the deep health check. Needs no API key.
   * Resolves with the body on 200 and on 503 (status 'degraded' or 'unhealthy').
   *
   * @returns {Promise<import('../index.js').HealthResponse>}
   * @throws {WdkIndexerApiError} on any other error status, or a 503 without a JSON body
   */
  health () {
    return this._request('GET', ['health'], { auth: false, okStatuses: [503] })
  }

  /**
   * GET /chains: supported blockchains, their tokens and address case rules. Needs no API key.
   *
   * @returns {Promise<import('../index.js').ChainsResponse>}
   * @throws {WdkIndexerApiError} on a non-success response
   */
  getChains () {
    return this._request('GET', ['chains'], { auth: false })
  }

  /**
   * GET /{blockchain}/{token}/{address}/token-transfers.
   *
   * @param {import('../index.js').Blockchain} blockchain
   * @param {import('../index.js').Token} token
   * @param {string} address wallet address
   * @param {import('../index.js').TokenTransferOptions} [options] limit, fromTs, toTs; sent as the query string
   * @returns {Promise<import('../index.js').TokenTransfersResponse>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if a path parameter is empty, '.' or '..'
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getTokenTransfers (blockchain, token, address, options) {
    assertSegments({ blockchain, token, address })
    return this._request('GET', [blockchain, token, address, 'token-transfers'], { query: options })
  }

  /**
   * GET /{blockchain}/{token}/{address}/token-balances.
   *
   * @param {import('../index.js').Blockchain} blockchain
   * @param {import('../index.js').Token} token
   * @param {string} address wallet address
   * @returns {Promise<import('../index.js').TokenBalanceResponse>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if a path parameter is empty, '.' or '..'
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getTokenBalance (blockchain, token, address) {
    assertSegments({ blockchain, token, address })
    return this._request('GET', [blockchain, token, address, 'token-balances'])
  }

  /**
   * GET /blockchains/{blockchain}/{token}/token-transfers/{txHash}: the transfers inside one transaction.
   *
   * @param {import('../index.js').Blockchain} blockchain
   * @param {import('../index.js').Token} token
   * @param {string} txHash transaction hash
   * @returns {Promise<import('../index.js').TransactionTransfersResponse>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if a path parameter is empty, '.' or '..'
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getTransactionTransfers (blockchain, token, txHash) {
    assertSegments({ blockchain, token, txHash })
    return this._request('GET', ['blockchains', blockchain, token, 'token-transfers', txHash])
  }

  /**
   * POST /batch/token-transfers. Results come back in request order; failed items are ApiError objects (see isApiError()).
   *
   * @param {import('../index.js').BatchTokenTransferRequest[]} requests 1 to 10 items
   * @returns {Promise<import('../index.js').BatchTokenTransfersItem[]>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if the array does not have 1 to 10 items
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getBatchTokenTransfers (requests) {
    assertList(requests, 'requests')
    return this._request('POST', ['batch', 'token-transfers'], { body: requests })
  }

  /**
   * POST /batch/token-balances. Results come back in request order; failed items are ApiError objects (see isApiError()).
   *
   * @param {import('../index.js').BatchTokenBalanceRequest[]} requests 1 to 10 items
   * @returns {Promise<import('../index.js').BatchTokenBalancesItem[]>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if the array does not have 1 to 10 items
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getBatchTokenBalances (requests) {
    assertList(requests, 'requests')
    return this._request('POST', ['batch', 'token-balances'], { body: requests })
  }

  /**
   * POST /wallets: register wallets whose transfers the server keeps syncing.
   *
   * @param {import('../index.js').WalletRegistration[]} wallets 1 to 10 wallets
   * @returns {Promise<import('../index.js').RegisterWalletsResponse>} one result per wallet, each with its own status
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if the array does not have 1 to 10 items
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async registerWallets (wallets) {
    assertList(wallets, 'wallets')
    return this._request('POST', ['wallets'], { body: wallets })
  }

  /**
   * GET /wallets.
   *
   * @returns {Promise<import('../index.js').ListWalletsResponse>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async listWallets () {
    return this._request('GET', ['wallets'])
  }

  /**
   * GET /wallets/{walletId}.
   *
   * @param {string} walletId
   * @returns {Promise<import('../index.js').Wallet>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if a path parameter is empty, '.' or '..'
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getWallet (walletId) {
    assertSegments({ walletId })
    return this._request('GET', ['wallets', walletId])
  }

  /**
   * PATCH /wallets/{walletId}: rename a wallet or turn its syncing on or off.
   *
   * @param {string} walletId
   * @param {import('../index.js').WalletUpdate} patch name, enabled, or both
   * @returns {Promise<import('../index.js').Wallet>} the updated wallet
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if a path parameter is empty, '.' or '..'
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async updateWallet (walletId, patch) {
    assertSegments({ walletId })
    return this._request('PATCH', ['wallets', walletId], { body: patch })
  }

  /**
   * DELETE /wallets/{walletId}.
   *
   * @param {string} walletId
   * @returns {Promise<import('../index.js').DeleteWalletResponse>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if a path parameter is empty, '.' or '..'
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async deleteWallet (walletId) {
    assertSegments({ walletId })
    return this._request('DELETE', ['wallets', walletId])
  }

  /**
   * GET /wallets/{walletId}/transfers: transfers synced for one wallet.
   *
   * @param {string} walletId
   * @param {import('../index.js').TransferFilters} [filters] sent as the query string
   * @returns {Promise<import('../index.js').WalletTransfersResponse>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerValidationError} if a path parameter is empty, '.' or '..'
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getWalletTransfers (walletId, filters) {
    assertSegments({ walletId })
    return this._request('GET', ['wallets', walletId, 'transfers'], { query: filters })
  }

  /**
   * GET /transfers: transfers synced across all registered wallets.
   *
   * @param {import('../index.js').TransferFilters} [filters] sent as the query string
   * @returns {Promise<import('../index.js').WalletTransfersResponse>}
   * @throws {WdkIndexerValidationError} if no API key is configured
   * @throws {WdkIndexerApiError} on a non-success response
   */
  async getTransfers (filters) {
    return this._request('GET', ['transfers'], { query: filters })
  }
}

module.exports = { WdkIndexerClient }
