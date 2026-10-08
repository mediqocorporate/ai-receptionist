import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('environment template uses OpenAI server secrets and keeps live API routes browser-safe', () => {
  const text = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
  assert.match(text, /OPENAI_API_KEY=/)
  assert.match(text, /OPENAI_MODEL=gpt-6\.1-sol/)
  assert.match(text, /OPENAI_EMBEDDING_MODEL=text-embedding-3-large/)
  assert.match(text, /MEDIQO_ASSISTANT_API_URL=\/api\/ask/)
  assert.match(text, /MEDIQO_ACCOUNT_SYNC_API_URL=\/api\/account-sync/)
  assert.match(text, /HUBSPOT_ACCESS_TOKEN=/)
  assert.doesNotMatch(text, /AZURE_OPENAI|HUBSPOT_PRIVATE_APP_TOKEN/)
})

test('Netlify routes API endpoints to functions before the SPA fallback', () => {
  const text = fs.readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
  const ask = text.indexOf('from = "/api/ask"')
  const account = text.indexOf('from = "/api/account-sync"')
  const fallback = text.indexOf('from = "/*"')
  assert.ok(ask >= 0 && account >= 0 && fallback >= 0)
  assert.ok(ask < fallback)
  assert.ok(account < fallback)
  assert.match(text, /directory = "netlify\/functions"/)
})
