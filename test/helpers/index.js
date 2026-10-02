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

// Shared fixtures for the unit tests.

// Minimal stand-in for a fetch Response.
function reply (status, body, statusText = '') {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  return { ok: status >= 200 && status < 300, status, statusText, text: async () => text }
}

// Mock fetch that records every call and answers with `respond`.
function mockFetch (respond = () => reply(200, { ok: true })) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, ...init })
    return respond(url, init)
  }
  fetch.calls = calls
  return fetch
}

// Await a rejection, check its class and message, and return it.
async function rejects (t, promise, ErrorClass, pattern) {
  try {
    await promise
  } catch (err) {
    t.ok(err instanceof ErrorClass, 'is ' + ErrorClass.name)
    t.ok(pattern.test(err.message), err.message)
    return err
  }
  t.fail('should reject')
  return {}
}

module.exports = { reply, mockFetch, rejects }
