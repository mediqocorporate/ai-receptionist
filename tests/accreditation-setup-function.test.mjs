import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationHandler } from '../netlify/functions/accreditation.mjs'

function event(body) {
  return { httpMethod: 'POST', headers: { authorization: 'Bearer jwt' }, body: JSON.stringify(body) }
}

test('overview returns first-visit setup state instead of silently creating an accreditation cycle', async () => {
  let createCalled = false
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      findAccreditationCycle: async (practiceId) => {
        assert.equal(practiceId, 'p1')
        return null
      },
      getAccreditationAgencies: async () => [],
      getOrCreateAccreditationCycle: async () => { createCalled = true; return { id: 'unexpected' } },
    }),
  })

  const response = await handler(event({ action: 'overview', practiceId: 'evil' }))
  assert.equal(response.statusCode, 200)
  const body = JSON.parse(response.body)
  assert.equal(body.overview.setupRequired, true)
  assert.equal(body.overview.cycle, null)
  assert.deepEqual(body.overview.agencies, [])
  assert.equal(createCalled, false)
})

test('setup creates the workspace only for the authenticated practice and then returns the real overview', async () => {
  let setupPayload
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      setupAccreditationWorkspace: async (payload) => {
        setupPayload = payload
        return { cycle: { id: 'c1' }, profile: { journey_status: 'REACCREDITATION' } }
      },
      getAccreditationOverview: async ({ practiceId, cycleId }) => ({
        cycle: { id: cycleId, practiceId },
        coverage: { answered: 0, total: 20, percent: 0 },
      }),
    }),
  })

  const response = await handler(event({
    action: 'setup',
    practiceId: 'evil',
    journeyStatus: 'REACCREDITATION',
    assessmentScheduled: true,
    targetAssessmentDate: '2027-02-15',
    accreditingAgencyId: '',
    practiceContext: { services: 'General practice', notes: 'Two locations' },
  }))
  assert.equal(response.statusCode, 200)
  assert.equal(setupPayload.practiceId, 'p1')
  assert.equal(setupPayload.userId, 'u1')
  assert.equal(setupPayload.targetAssessmentDate, '2027-02-15')
  assert.equal(JSON.parse(response.body).overview.cycle.id, 'c1')
})

test('practice information is read only from the authenticated practice and exposes provenance', async () => {
  let received
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getAccreditationPracticeInformation: async (payload) => {
        received = payload
        return {
          facts: [
            { key: 'practice_name', label: 'Practice name', value: 'Harbour Medical Centre', provenance: 'MediQo account' },
          ],
        }
      },
    }),
  })

  const response = await handler(event({ action: 'practice_information', practiceId: 'evil', cycleId: 'c1' }))
  assert.equal(response.statusCode, 200)
  assert.deepEqual(received, { practiceId: 'p1', cycleId: 'c1' })
  assert.match(response.body, /MediQo account/)
})
