# Changelog

All notable changes to `@tetherto/wdk-indexer-http` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - Unreleased

A rewrite against the WDK Indexer OpenAPI v1 spec. If you're upgrading from 1.0.0-beta.1, read the breaking changes first.

### Added

- `getChains()` (`GET /chains`) returns the supported blockchains, their tokens and address case-sensitivity rules. It needs no API key.
- `getTransactionTransfers(blockchain, token, txHash)` returns the transfers of one token inside one transaction.
- Wallet sync endpoints: `registerWallets()`, `listWallets()`, `getWallet()`, `updateWallet()`, `deleteWallet()`, `getWalletTransfers()` and `getTransfers()`, with `blockchain`, `token`, `type`, `from`, `to`, `limit`, `skip` and `sort` filters.
- CommonJS and ESM from one file. `require()` and named `import` return the same classes, so `instanceof` works across both.
- Bare runtime support. The `#fetch` and `#abort-controller` import maps pick `bare-fetch` and `bare-abort-controller` on Bare, and the globals on Node. Both are optional peer dependencies: install them on Bare (`npm install bare-fetch bare-abort-controller`); Node installs nothing extra.
- Hand-written TypeScript definitions (`index.d.ts`) for every request and response shape. `isApiError()` is a type guard, true for any item with a string `error`.
- Error details:
  - `WdkIndexerApiError` has `status` (the HTTP status), `errorType`, `message` and the parsed `body`.
  - `WdkIndexerTimeoutError` has `timeout`.
  - `WdkIndexerNetworkError` has `cause`.
  - An empty or non-JSON error body produces the message `HTTP <status> <statusText>`.
- The only client-side check is that authenticated methods need an API key. Path parameters are inserted into the URL as given, without encoding (see the README for the edge cases), and query options are sent as given, except that keys set to `undefined` or `null` are left out. The query string is built with `URLSearchParams`, so a space is encoded as `+` rather than `%20`. Everything else is validated by the server.
- Unit tests run on both Node and Bare (`npm test`, `npm run test:bare`). Opt-in live tests run with `npm run test:integration`.

### Breaking changes

- **The ESM default export is removed.** `import WdkIndexerClient from '@tetherto/wdk-indexer-http'` now gives you the exports object, not the class. Switch to the named import: `import { WdkIndexerClient } from '@tetherto/wdk-indexer-http'`. `require()` is unchanged.
- The default base URL is now `https://wdk-api.tether.su` (it was `https://wdk-api.tether.io`). Pass `baseUrl` to use another deployment.
- `plasma` is gone. `avalanche` and the `usat` token are new.
- `fromTs` and `toTs` are milliseconds, not seconds, in `getTokenTransfers()` and batch transfer items. Multiply old values by 1000.
- `health()` returns a different body: `{ status: 'healthy' | 'degraded' | 'unhealthy', timestamp, deployEnvironment, deployedVersion, summary, checks }` instead of `{ status: 'ok', timestamp }`. The API answers 503 whenever the status isn't `healthy`, and `health()` resolves with the body on 200 and 503 alike. Other error statuses still reject.
- The constructor no longer throws without an `apiKey`. `health()` and `getChains()` work without one and never send it. Every other method rejects with `WdkIndexerError('API key is required')` before sending anything.
- `createClient()` is removed. Use `new WdkIndexerClient(config)`.
- `isTokenTransfersResponse()` and `isTokenBalanceResponse()` are removed. Use `isApiError(item)` to spot failed batch items.
- `BLOCKCHAINS` and `TOKENS` are removed, because a hard-coded list goes stale every time the server adds a chain. Call `getChains()` for the current list. The TypeScript types still autocomplete the known names.
- The client no longer rejects unknown chains or tokens. The server decides what it supports and answers 400 for an unsupported pair.
- `WdkIndexerApiError.status` is always the HTTP status, and `WdkIndexerNetworkError` takes the underlying error as its only argument.
- `apiKey`, `baseUrl`, `timeout` and `fetchFn` are no longer public properties of the client.
- `bare-wdk-runtime` is dropped. The `./bare` subpath is an alias of the main entry. There are no runtime dependencies on Node; `bare-fetch` and `bare-abort-controller` are optional peer dependencies, needed only on Bare.
- Node.js 22 or later is required (it was 18).
- The package is no longer `"type": "module"`. The source is CommonJS, and ESM code imports it with named imports.

## [1.0.0-beta.1]

- Initial beta: `health()`, `getTokenTransfers()`, `getTokenBalance()`, `getBatchTokenTransfers()`, `getBatchTokenBalances()` and `createClient()`.
