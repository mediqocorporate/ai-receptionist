import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const functionUrl = new URL('../netlify/functions/accreditation.mjs', import.meta.url)

function event(body = {}, authorization = 'Bearer good') {
  return {
    httpMethod: 'POST',
    headers: authorization ? { authorization } : {},
    body: JSON.stringify(body),
  }
}

async function loadModule() {
  if (!fs.existsSync(functionUrl)) return null
  return import(functionUrl.href)
}

function overviewPayload() {
  return {
    cycle: { id: 'cycle_1', practiceId: 'practice_1', standardVersionId: 'RACGP5', status: 'ACTIVE' },
    standardVersion: { id: 'RACGP5', name: 'RACGP Standards for general practices', edition: '5th edition' },
    coverage: { answered: 0, total: 20, percent: 0 },
    statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 0, NOT_CHECKED: 124 },
    assessedCount: 0,
    nextQuestion: null,
    nextAction: 'Start the Quick Readiness Check.',
  }
}

test('accreditation function exists', async () => {
  assert.equal(fs.existsSync(functionUrl), true)
  assert.ok(await loadModule())
})

test('missing or invalid Supabase session returns 401', async () => {
  const mod = await loadModule()
  assert.ok(mod)
  const handler = mod.createAccreditationHandler({
    authenticate: async () => null,
    createServer: () => { throw new Error('server should not be created') },
  })
  const missing = await handler(event({ action: 'overview' }, ''))
  assert.equal(missing.statusCode, 401)
  const invalid = await handler(event({ action: 'overview' }, 'Bearer invalid'))
  assert.equal(invalid.statusCode, 401)
})

test('overview always scopes the cycle and data to authenticated practice', async () => {
  const mod = await loadModule()
  const calls = []
  const server = {
    getOrCreateAccreditationCycle: async (practiceId) => {
      calls.push(['cycle', practiceId])
      return { id: 'cycle_1', practice_id: practiceId, standard_version_id: 'RACGP5', status: 'ACTIVE' }
    },
    getAccreditationOverview: async ({ practiceId, cycleId }) => {
      calls.push(['overview', practiceId, cycleId])
      return { ...overviewPayload(), cycle: { ...overviewPayload().cycle, id: cycleId, practiceId } }
    },
  }
  const handler = mod.createAccreditationHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => server,
  })
  const response = await handler(event({ action: 'overview', practiceId: 'practice_evil' }))
  assert.equal(response.statusCode, 200)
  assert.deepEqual(calls, [
    ['cycle', 'practice_1'],
    ['overview', 'practice_1', 'cycle_1'],
  ])
})

test('answer persists actor identity, deterministic assessment and then refreshes overview', async () => {
  const mod = await loadModule()
  const calls = []
  const server = {
    getOrCreateAccreditationCycle: async (practiceId, cycleId) => {
      calls.push(['cycle', practiceId, cycleId])
      return { id: 'cycle_1', practice_id: practiceId, standard_version_id: 'RACGP5', status: 'ACTIVE' }
    },
    getAccreditationQuestion: async ({ questionId }) => ({
      id: questionId,
      requirement_id: 'R1',
      wording: 'Is this in place?',
      answer_options: ['Yes', 'No', "I'm not sure"],
      requirement: {
        id: 'R1',
        classification: 'MANDATORY',
        content_validation_status: 'VALIDATION_REQUIRED',
        is_active: true,
        applicability_rule: 'Universal',
        plain_english_requirement: 'Maintain the process.',
      },
    }),
    getPracticeRequirement: async () => null,
    saveReadinessResponse: async (payload) => { calls.push(['response', payload]); return { id: 'resp_1' } },
    upsertPracticeRequirementAssessment: async (payload) => { calls.push(['assessment', payload]); return { id: 'pr_1', ...payload } },
    getAccreditationOverview: async ({ practiceId, cycleId }) => ({ ...overviewPayload(), cycle: { ...overviewPayload().cycle, id: cycleId, practiceId } }),
  }
  const handler = mod.createAccreditationHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => server,
  })
  const response = await handler(event({ action: 'answer', cycleId: 'cycle_1', questionId: 'Q1', answerLabel: 'No', practiceId: 'practice_evil' }))
  assert.equal(response.statusCode, 200)
  const responseCall = calls.find(([type]) => type === 'response')[1]
  assert.equal(responseCall.practiceId, 'practice_1')
  assert.equal(responseCall.userId, 'user_1')
  assert.equal(responseCall.cycleId, 'cycle_1')
  const assessmentCall = calls.find(([type]) => type === 'assessment')[1]
  assert.equal(assessmentCall.practiceId, 'practice_1')
  assert.equal(assessmentCall.assessment.readinessStatus, 'CONFIRMED_GAP')
})

test('requirement detail is scoped to actor practice and active cycle', async () => {
  const mod = await loadModule()
  const calls = []
  const server = {
    getOrCreateAccreditationCycle: async (practiceId, cycleId) => ({ id: cycleId || 'cycle_1', practice_id: practiceId }),
    getAccreditationRequirement: async (payload) => {
      calls.push(payload)
      return { id: 'R1', readinessStatus: 'NOT_CHECKED' }
    },
  }
  const handler = mod.createAccreditationHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'practice_1' }),
    createServer: () => server,
  })
  const response = await handler(event({ action: 'requirement', cycleId: 'cycle_1', requirementId: 'R1', practiceId: 'practice_evil' }))
  assert.equal(response.statusCode, 200)
  assert.deepEqual(calls[0], { practiceId: 'practice_1', cycleId: 'cycle_1', requirementId: 'R1' })
})
