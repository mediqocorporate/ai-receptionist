import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccountSyncHandler } from '../netlify/functions/account-sync.mjs'

function event({ authorization = 'Bearer good', cookie = '' } = {}) {
  return {
    httpMethod: 'POST',
    headers: { authorization, ...(cookie ? { cookie } : {}), 'x-forwarded-proto': 'https', host: 'pm.mediqo.health' },
    body: '{}',
  }
}

const actor = {
  userId: 'u1', practiceId: 'p1', email: 'sarah@example.com',
  firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager', practiceName: 'Harbour Family Clinic',
}

test('missing HubSpot access keeps an idempotent CRM outbox job pending without blocking the account', async () => {
  const calls = []
  const server = {
    upsertCrmJob: async (job) => { calls.push(['job', job]); return { id: 'job1' } },
    updateCrmJob: async (...args) => { calls.push(['update', ...args]) },
    claimAnonymous: async () => {},
  }
  const handler = createAccountSyncHandler({
    env: {}, authenticate: async () => actor, createServer: () => server,
    syncContact: async ({ token, contact }) => { calls.push(['hubspot', token, contact]); return { status: 'pending', reason: 'hubspot_not_configured' } },
  })
  const response = await handler(event())
  assert.equal(response.statusCode, 202)
  assert.equal(JSON.parse(response.body).status, 'queued')
  assert.equal(calls[0][0], 'job')
  assert.equal(calls[0][1].eventType, 'platform_signup')
  assert.equal(calls[1][0], 'hubspot')
  assert.equal(calls[1][1], undefined)
  assert.deepEqual(calls[1][2], {
    email: 'sarah@example.com', firstname: 'Sarah', lastname: 'Jones', jobtitle: 'Practice Manager', company: 'Harbour Family Clinic',
  })
  assert.equal(calls.some(([kind]) => kind === 'update'), false)
})

test('successful HubSpot sync marks the CRM outbox job synced', async () => {
  const updates = []
  const server = {
    upsertCrmJob: async () => ({ id: 'job1' }),
    updateCrmJob: async (id, patch) => { updates.push([id, patch]) },
    claimAnonymous: async () => {},
  }
  const handler = createAccountSyncHandler({
    env: { HUBSPOT_ACCESS_TOKEN: 'secret' }, authenticate: async () => actor, createServer: () => server,
    syncContact: async () => ({ status: 'synced', contactId: 'hs1' }),
  })
  const response = await handler(event())
  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).status, 'synced')
  assert.equal(updates[0][0], 'job1')
  assert.equal(updates[0][1].status, 'synced')
  assert.equal(updates[0][1].last_error, null)
})

test('account sync claims anonymous history before CRM processing', async () => {
  const order = []
  const server = {
    claimAnonymous: async (hash, userId, practiceId) => order.push(['claim', hash, userId, practiceId]),
    upsertCrmJob: async () => { order.push(['job']); return { id: 'job1' } },
    updateCrmJob: async () => {},
  }
  const handler = createAccountSyncHandler({
    env: {}, authenticate: async () => actor, createServer: () => server,
    hashFn: async (value) => `hash:${value}`,
    syncContact: async () => ({ status: 'pending' }),
  })
  const response = await handler(event({ cookie: 'mediqo_anon=previous' }))
  assert.deepEqual(order, [['claim', 'hash:previous', 'u1', 'p1'], ['job']])
  assert.match(response.headers?.['Set-Cookie'] || '', /^mediqo_anon=;/)
  assert.match(response.headers['Set-Cookie'], /Max-Age=0/)
})
