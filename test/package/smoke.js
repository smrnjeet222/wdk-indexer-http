'use strict'

// Smoke test for the published layout. CI copies this file into a clean project
// that has the packed tarball installed, then runs it with node and bare:
//   node smoke.js   /   bare smoke.js
// It needs network access for one live getChains() call through the default fetch.

const assert = (ok, message) => {
  if (!ok) throw new Error('smoke test failed: ' + message)
}

async function main () {
  const cjs = require('@tetherto/wdk-indexer-http')
  const bare = require('@tetherto/wdk-indexer-http/bare')
  const esm = await import('@tetherto/wdk-indexer-http')
  const esmBare = await import('@tetherto/wdk-indexer-http/bare')

  assert(typeof cjs.WdkIndexerClient === 'function', 'require() exports WdkIndexerClient')
  assert(bare.WdkIndexerClient === cjs.WdkIndexerClient, './bare is an alias of the main entry')
  assert(esm.default === cjs.WdkIndexerClient, 'ESM default export is WdkIndexerClient')
  assert(esm.WdkIndexerApiError === cjs.WdkIndexerApiError, 'ESM and CJS share error classes')
  assert(esmBare.default === cjs.WdkIndexerClient, 'ESM ./bare default export is WdkIndexerClient')
  assert(cjs.default === undefined, 'CJS entry has no default property')

  const { chains } = await new esm.default({ timeout: 20000 }).getChains() // eslint-disable-line new-cap
  assert(Array.isArray(chains) && chains.length > 0, 'getChains() returns chains through the default fetch')
  console.log('smoke ok:', chains.length, 'chains')
}

main().catch((err) => {
  console.error(err)
  if (globalThis.process) globalThis.process.exitCode = 1
  else globalThis.Bare.exitCode = 1
})
