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
}

module.exports = { WdkIndexerClient }
