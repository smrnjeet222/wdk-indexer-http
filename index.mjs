// ESM entry: re-exports the CommonJS build so both formats share one
// implementation (and one set of error classes for instanceof checks).
import api from './index.js'

export const {
  WdkIndexerClient,
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError,
  BATCH_LIMIT
} = api

export default api.WdkIndexerClient
