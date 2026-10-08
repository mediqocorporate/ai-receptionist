import test from 'node:test'
import assert from 'node:assert/strict'
import { createLeadService } from '../src/services/lead-service.js'

function response(status, body) { return { ok: status >= 200 && status < 300, status, async json() { return body } } }

test('platform CRM sync is skipped when the account-sync endpoint is not configured', async () => {
  const service = createLeadService({ config: { accountSyncApiUrl: '' } })
  assert.deepEqual(await service.syncPlatformAccount(), { status: 'skipped' })
})

test('platform CRM sync sends the signed-in Supabase bearer token and includes anonymous cookie', async () => {
  let request
  const service = createLeadService({
    config: { accountSyncApiUrl: '/api/account-sync' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (url, init) => { request = { url, init }; return response(202, { status: 'queued' }) },
  })
  assert.deepEqual(await service.syncPlatformAccount(), { status: 'queued' })
  assert.equal(request.url, '/api/account-sync')
  assert.equal(request.init.headers.Authorization, 'Bearer jwt')
  assert.equal(request.init.credentials, 'include')
})

test('CRM provider failure never throws into signup or login UX', async () => {
  const service = createLeadService({
    config: { accountSyncApiUrl: '/api/account-sync' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async () => { throw new Error('network down') },
  })
  assert.deepEqual(await service.syncPlatformAccount(), { status: 'queued' })
})
