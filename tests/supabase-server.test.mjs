import test from 'node:test'
import assert from 'node:assert/strict'
import { authenticateUser, createSupabaseServer } from '../netlify/functions/_shared/supabase-server.mjs'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
}

test('authenticateUser validates bearer token and loads practice context with the user JWT', async () => {
  const calls = []
  const fetchImpl = async (url, options={}) => {
    calls.push({ url, options })
    if (url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user_1', email: 'imran@example.com' }), { status: 200, headers: { 'content-type':'application/json' } })
    }
    if (url.endsWith('/rest/v1/rpc/get_current_account_context')) {
      return new Response(JSON.stringify([{ first_name: 'Imran', last_name: 'Gul', job_title: 'Practice Manager', practice_id: 'practice_1', practice_name: 'Test Clinic', role: 'owner', jurisdictions: ['NSW'] }]), { status: 200, headers: { 'content-type':'application/json' } })
    }
    throw new Error(`unexpected ${url}`)
  }
  const actor = await authenticateUser({ authorization: 'Bearer jwt-user', env, fetchImpl })
  assert.equal(actor.userId, 'user_1')
  assert.equal(actor.practiceId, 'practice_1')
  assert.equal(actor.firstName, 'Imran')
  assert.equal(actor.jobTitle, 'Practice Manager')
  assert.equal(calls[0].options.headers.apikey, 'publishable')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer jwt-user')
  assert.equal(calls[1].options.headers.Authorization, 'Bearer jwt-user')
})

test('service RPCs use the service role only on the server', async () => {
  let call
  const fetchImpl = async (url, options) => {
    call = { url, options, body: JSON.parse(options.body) }
    return new Response(JSON.stringify([{ session_id: 'anon_1', allowed: true, remaining_after_reservation: 1 }]), { status: 200, headers: { 'content-type':'application/json' } })
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.reserveAnonymous('hash')
  assert.equal(call.options.headers.apikey, 'service-secret')
  assert.equal(call.options.headers.Authorization, 'Bearer service-secret')
  assert.deepEqual(call.body, { p_token_hash: 'hash' })
  assert.deepEqual(result, { sessionId: 'anon_1', allowed: true, remaining: 1 })
})
