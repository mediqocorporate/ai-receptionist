import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationService } from '../src/services/accreditation-service.js'

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

function makeService(payloads) {
  return createAccreditationService({
    config: {},
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      payloads.push(body)
      if (body.action === 'setup') return response(200, { overview: { cycle: { id: 'c1' } } })
      if (body.action === 'practice_information') return response(200, { practiceInformation: { facts: [] } })
      return response(200, { overview: { setupRequired: true, cycle: null } })
    },
  })
}

test('accreditation browser service exposes setup and Practice Information actions', async () => {
  const payloads = []
  const service = makeService(payloads)
  await service.setup({
    journeyStatus: 'NOT_SURE',
    assessmentScheduled: null,
    targetAssessmentDate: null,
    accreditingAgencyId: null,
    practiceContext: { services: '' },
  })
  await service.practiceInformation({ cycleId: 'c1' })

  assert.equal(payloads[0].action, 'setup')
  assert.equal(payloads[0].journeyStatus, 'NOT_SURE')
  assert.deepEqual(payloads[1], { action: 'practice_information', cycleId: 'c1' })
})
