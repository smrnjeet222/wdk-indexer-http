# Changelog

All notable changes to `@tetherto/wdk-indexer-http` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - Unreleased

This release is a ground-up rewrite against the WDK Indexer OpenAPI v1 spec. See **Breaking changes** below if you are upgrading from 1.0.0-beta.1.

### Added

- `getChains()` (`GET /chains`) returns the supported blockchains, their tokens and address case-sensitivity rules. It needs no API key.
- `getTransactionTransfers(blockchain, token, txHash)` returns the transfers of one token inside one transaction.
- Wallet sync endpoints: `registerWallets()`, `listWallets()`, `getWallet()`, `updateWallet()`, `deleteWallet()`, `getWalletTransfers()` and `getTransfers()`, with `blockchain`, `token`, `type`, `from`, `to`, `limit`, `skip` and `sort` filters.
- Chains and tokens: `avalanche` and `usat` (USAt) in the TypeScript types.
- CommonJS and ESM from one implementation. `require()` and `import` return the same classes, so `instanceof` works across both.
- Bare runtime support with no setup. The `#fetch` import map picks `bare-fetch` on Bare and the global `fetch` on Node.
- Hand-written TypeScript definitions (`index.d.ts` for CommonJS, `index.d.mts` for ESM) for every request and response shape. `isApiError()` is a type guard, true for any item with a string `error`.
- Error details:
  - `WdkIndexerApiError` has `status` (the HTTP status), `errorType`, `message` and the parsed `body`.
  - `WdkIndexerTimeoutError` has `timeout`.
  - `WdkIndexerNetworkError` has `cause`.
  - An empty or non-JSON error body produces the message `HTTP <status> <statusText>`.
- Client-side checks are limited to what the server can't check: path parameters must be non-empty strings other than `.` and `..`, batch arrays must have 1 to 10 items, and authenticated methods need an API key. Everything else is validated by the server.
- Unit tests run on both Node and Bare (`npm test`, `npm run test:bare`). Opt-in live tests run with `npm run test:integration`.

### Breaking changes

- **The default base URL is now `https://wdk-api.tether.su`** (it was `https://wdk-api.tether.io`). Pass `baseUrl` to use a different deployment.
- **Chains and tokens:** `plasma` was removed. `avalanche` and `usat` were added.
- **`fromTs` / `toTs` are in milliseconds**, not seconds. This applies to `getTokenTransfers()` and batch transfer items. Multiply old values by 1000.
- **New `health()` response.** It now returns `{ status: 'healthy' | 'degraded' | 'unhealthy', timestamp, deployEnvironment, deployedVersion, summary, checks }` instead of `{ status: 'ok', timestamp }`. The API answers 503 when the status is not `healthy`. `health()` resolves with the body on both 200 and 503, and rejects on any other error status.
- **`apiKey` is optional in the constructor.** The constructor no longer throws without a key. `health()` and `getChains()` work without one and never send it. Every other method rejects with `WdkIndexerValidationError('API key is required')` before sending a request.
- **`createClient()` was removed.** Use `new WdkIndexerClient(config)`.
- **`isTokenTransfersResponse()` and `isTokenBalanceResponse()` were removed.** Use `isApiError(item)` to tell failed batch items apart.
- **`BLOCKCHAINS` and `TOKENS` were removed.** A hard-coded list goes stale as the server adds chains. Use `getChains()` for the current list; the TypeScript types still autocomplete the known names.
- **Unknown chains and tokens are no longer rejected on the client.** The server decides what it supports and returns HTTP 400 for unsupported pairs. Use `getChains()` to discover what is supported.
- **Error constructors and fields changed.** `WdkIndexerApiError.status` is always the HTTP status, and `WdkIndexerNetworkError` now takes the underlying error as its only argument. A missing API key is now a `WdkIndexerValidationError`, not a base `WdkIndexerError`.
- **The client no longer exposes `apiKey`, `baseUrl`, `timeout` or `fetchFn` as public properties.**
- **`bare-wdk-runtime` was dropped.** The `./bare` subpath is now an alias of the main entry, and the package depends only on `bare-fetch`.
- **Node.js >= 22 is required** (it was >= 18).
- The package is no longer `"type": "module"`. The source is CommonJS, and `index.mjs` provides the ESM entry. Named and default ESM imports keep working.

## [1.0.0-beta.1]

- Initial beta: `health()`, `getTokenTransfers()`, `getTokenBalance()`, `getBatchTokenTransfers()`, `getBatchTokenBalances()` and `createClient()`.
