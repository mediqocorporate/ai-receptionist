import test from 'node:test'
import assert from 'node:assert/strict'
import { syncHubSpotContact } from '../netlify/functions/_shared/hubspot.mjs'

test('HubSpot sync is safely disabled when access is not configured', async () => {
  const result = await syncHubSpotContact({ token: '', contact: { email: 'test@example.com' }, fetchImpl: async () => { throw new Error('must not call network') } })
  assert.deepEqual(result, { status: 'pending', reason: 'hubspot_not_configured' })
})

test('HubSpot sync updates an existing contact found by email', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null })
    if (url.endsWith('/search')) {
      return new Response(JSON.stringify({ results: [{ id: 'contact_1' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'contact_1' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const result = await syncHubSpotContact({ token: 'pat-test', contact: { email: 'test@example.com', firstname: 'Imran', lastname: 'Test' }, fetchImpl })
  assert.equal(result.status, 'synced')
  assert.equal(result.contactId, 'contact_1')
  assert.match(calls[1].url, /crm\/v3\/objects\/contacts\/contact_1$/)
  assert.equal(calls[1].options.method, 'PATCH')
})
