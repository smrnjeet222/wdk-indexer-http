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

// Type test for the CommonJS entry, checked by `npm run test:types` (never executed).
import api = require('@tetherto/wdk-indexer-http')
import bare = require('@tetherto/wdk-indexer-http/bare')

const client = new api.WdkIndexerClient({ apiKey: 'key' })
const other: api.WdkIndexerClient = new bare.WdkIndexerClient()
const limit: 10 = api.BATCH_LIMIT

export async function check (): Promise<void> {
  const { chains } = await client.getChains()
  const name: string = chains[0].name
  void name
  void other
  void limit
  // @ts-expect-error the CommonJS entry has no default export at runtime
  void api.default
}
