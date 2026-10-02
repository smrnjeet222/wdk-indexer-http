import test from 'brittle'
import WdkIndexerClientDefault, {
  WdkIndexerClient,
  WdkIndexerError,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  WdkIndexerValidationError,
  isApiError,
  BATCH_LIMIT
} from '@tetherto/wdk-indexer-http'
import * as esm from '@tetherto/wdk-indexer-http'
import cjs from '../index.js'
import * as bare from '@tetherto/wdk-indexer-http/bare'

test('import resolves named exports', (t) => {
  t.is(BATCH_LIMIT, 10)
  t.is(typeof WdkIndexerClient, 'function')
  t.is(typeof isApiError, 'function')
  t.ok(isApiError({ error: 'Bad Request', message: 'nope' }))
})

test('default export is WdkIndexerClient', (t) => {
  t.is(WdkIndexerClientDefault, WdkIndexerClient)
  t.is(esm.default, cjs.WdkIndexerClient)
})

test('ESM exposes every CJS export by name', (t) => {
  t.alike(Object.keys(esm).filter((k) => k !== 'default').sort(), Object.keys(cjs).sort())
  for (const key of Object.keys(cjs)) t.is(esm[key], cjs[key], key)
})

test('ESM and CJS share one implementation', (t) => {
  t.is(WdkIndexerClient, cjs.WdkIndexerClient)
  t.is(WdkIndexerError, cjs.WdkIndexerError)
})

test('instanceof works across require and import', async (t) => {
  const fetch = async () => ({ ok: false, status: 404, statusText: 'Not Found', text: async () => '' })
  const esmClient = new WdkIndexerClient({ apiKey: 'k', fetch })
  const cjsClient = new cjs.WdkIndexerClient({ apiKey: 'k', fetch })
  t.ok(esmClient instanceof cjs.WdkIndexerClient)
  t.ok(cjsClient instanceof WdkIndexerClient)

  for (const client of [esmClient, cjsClient]) {
    try {
      await client.getWallet('missing')
      t.fail('should reject')
    } catch (err) {
      t.ok(err instanceof WdkIndexerApiError && err instanceof cjs.WdkIndexerApiError)
      t.ok(err instanceof WdkIndexerError && err instanceof cjs.WdkIndexerError)
      t.is(err.status, 404)
    }
  }

  for (const [Esm, name] of [[WdkIndexerTimeoutError, 'WdkIndexerTimeoutError'], [WdkIndexerNetworkError, 'WdkIndexerNetworkError'], [WdkIndexerValidationError, 'WdkIndexerValidationError']]) {
    t.ok(new cjs[name]() instanceof Esm, name + ' from require is instanceof import')
    t.ok(new Esm() instanceof cjs.WdkIndexerError, name + ' from import is instanceof require base')
  }
})

test('import of the ./bare alias resolves the same module', (t) => {
  t.is(bare.WdkIndexerClient, WdkIndexerClient)
  t.is(bare.default, WdkIndexerClient)
})
