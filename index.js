'use strict'

const { WdkIndexerClient } = require('./lib/client.js')
const {
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError
} = require('./lib/errors.js')

// Most items the server accepts per batch request or registerWallets() call.
const BATCH_LIMIT = 10

module.exports = {
  WdkIndexerClient,
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError,
  BATCH_LIMIT
}
