import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEnvText, publicRuntimeConfig, runtimeConfigScript } from '../scripts/runtime-config.mjs'

test('runtime config parses local env files and exposes only browser-safe values', () => {
  const env = parseEnvText(`SUPABASE_URL=https://example.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_test
SUPABASE_SERVICE_ROLE_KEY=secret
AZURE_OPENAI_API_KEY=secret2
`)
  assert.deepEqual(publicRuntimeConfig(env), {
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'sb_publishable_test',
    appUrl: '',
  })
})

test('runtime config accepts legacy anon key and never emits server secrets', () => {
  const script = runtimeConfigScript({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'legacy-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'do-not-expose',
    AZURE_OPENAI_API_KEY: 'do-not-expose-either',
  })
  assert.match(script, /legacy-anon/)
  assert.doesNotMatch(script, /do-not-expose/)
})
