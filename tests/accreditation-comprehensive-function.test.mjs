import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationHandler } from '../netlify/functions/accreditation.mjs'

test('comprehensive_check action is scoped to the authenticated practice and cycle', async () => {
  let payload
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async (practiceId, cycleId) => {
        assert.equal(practiceId, 'p1')
        assert.equal(cycleId, 'c1')
        return { id: 'c1' }
      },
      getAccreditationComprehensiveCheck: async (value) => {
        payload = value
        return { coverage: { answered: 0, total: 1, percent: 0 }, nextQuestion: { id: 'Q1' } }
      },
    }),
  })
  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer jwt' },
    body: JSON.stringify({ action: 'comprehensive_check', practiceId: 'evil', cycleId: 'c1' }),
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(payload, { practiceId: 'p1', cycleId: 'c1' })
  assert.match(response.body, /Q1/)
})
