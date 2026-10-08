import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationService } from '../src/services/accreditation-service.js'

test('browser service loads the server-owned comprehensive check', async () => {
  let payload
  const service = createAccreditationService({
    config: {},
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(init.body)
      return { ok: true, status: 200, async json() { return { comprehensiveCheck: { coverage: { answered: 0, total: 55, percent: 0 } } } } }
    },
  })
  const result = await service.comprehensiveCheck({ cycleId: 'c1' })
  assert.deepEqual(payload, { action: 'comprehensive_check', cycleId: 'c1' })
  assert.equal(result.coverage.total, 55)
})
