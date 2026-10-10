import test from 'node:test'
import assert from 'node:assert/strict'
import { createAskHandler } from '../netlify/functions/ask.mjs'

function event({ body = {}, authorization = '', cookie = '', proto = 'https' } = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(cookie ? { cookie } : {}),
      'x-forwarded-proto': proto,
      host: 'pm.mediqo.health',
    },
    body: JSON.stringify(body),
  }
}

test('invalid bearer authentication returns 401 and is never downgraded to anonymous', async () => {
  let serverCreated = false
  const handler = createAskHandler({
    authenticate: async () => null,
    createServer: () => { serverCreated = true; return {} },
    generateAnswer: async () => { throw new Error('should not call') },
    processAskFn: async () => { throw new Error('should not call') },
  })
  const response = await handler(event({ authorization: 'Bearer invalid', body: { question: 'Hello' } }))
  assert.equal(response.statusCode, 401)
  assert.equal(JSON.parse(response.body).code, 'invalid_session')
  assert.equal(serverCreated, false)
})

test('anonymous request stores only a hash of a newly issued opaque cookie token', async () => {
  let receivedHash = ''
  const handler = createAskHandler({
    authenticate: async () => null,
    createServer: () => ({ marker: 'server' }),
    randomTokenFn: () => 'raw-secret-token',
    hashFn: async (value) => `hash:${value}`,
    generateAnswer: async () => ({ answer: {} }),
    processAskFn: async (input) => {
      receivedHash = input.anonymousTokenHash
      return { statusCode: 200, body: { ok: true } }
    },
    env: { OPENAI_API_KEY: 'server-secret' },
  })
  const response = await handler(event({ body: { question: 'Hello' } }))
  assert.equal(response.statusCode, 200)
  assert.equal(receivedHash, 'hash:raw-secret-token')
  assert.match(response.headers['Set-Cookie'], /^mediqo_anon=raw-secret-token;/)
  assert.match(response.headers['Set-Cookie'], /HttpOnly/)
  assert.doesNotMatch(receivedHash, /^raw-secret-token$/)
})

test('authenticated request claims prior anonymous history before asking', async () => {
  const order = []
  const server = {
    claimAnonymous: async (hash, userId, practiceId) => { order.push(['claim', hash, userId, practiceId]) },
  }
  const actor = { userId: 'u1', practiceId: 'p1', email: 'a@example.com' }
  const handler = createAskHandler({
    authenticate: async () => actor,
    createServer: () => server,
    hashFn: async (value) => `hash:${value}`,
    processAskFn: async (input) => { order.push(['ask', input.actor.userId]); return { statusCode: 200, body: { ok: true } } },
    env: { OPENAI_API_KEY: 'server-secret' },
  })
  const response = await handler(event({ authorization: 'Bearer good', cookie: 'mediqo_anon=old-token', body: { question: 'Hello' } }))
  assert.equal(response.statusCode, 200)
  assert.deepEqual(order, [
    ['claim', 'hash:old-token', 'u1', 'p1'],
    ['ask', 'u1'],
  ])
  assert.match(response.headers?.['Set-Cookie'] || '', /^mediqo_anon=;/)
  assert.match(response.headers['Set-Cookie'], /Max-Age=0/)
})

test('a stale anonymous cookie claimed by another account does not block an authenticated user', async () => {
  let asked = false
  const handler = createAskHandler({
    authenticate: async () => ({ userId: 'u2', practiceId: 'p2', email: 'b@example.com' }),
    createServer: () => ({ claimAnonymous: async () => { throw new Error('anonymous_session_already_claimed') } }),
    hashFn: async (value) => `hash:${value}`,
    processAskFn: async () => { asked = true; return { statusCode: 200, body: { ok: true } } },
  })
  const response = await handler(event({ authorization: 'Bearer good', cookie: 'mediqo_anon=old-owner', body: { question: 'Hello' } }))
  assert.equal(response.statusCode, 200)
  assert.equal(asked, true)
  assert.match(response.headers['Set-Cookie'], /Max-Age=0/)
})


test('accreditation mode requires a signed-in practice instead of using anonymous quota', async () => {
  let processed = false
  const handler = createAskHandler({
    authenticate: async () => null,
    createServer: () => ({}),
    processAskFn: async () => { processed = true; return { statusCode: 200, body: {} } },
  })
  const response = await handler(event({ body: { question: 'What should we prioritise?', mode: 'accreditation', cycleId: 'c1' } }))
  assert.equal(response.statusCode, 401)
  assert.equal(JSON.parse(response.body).code, 'authentication_required')
  assert.equal(processed, false)
})

test('accreditation mode builds server-owned readiness context and controlled resources before OpenAI', async () => {
  const calls = []
  let generatedPayload
  const server = {
    getOrCreateAccreditationCycle: async (practiceId, cycleId) => {
      calls.push(['cycle', practiceId, cycleId])
      return { id: 'cycle_real' }
    },
    getAccreditationOverview: async ({ practiceId, cycleId }) => {
      calls.push(['overview', practiceId, cycleId])
      return {
        cycle: { id: cycleId },
        standardVersion: { name: 'RACGP Standards for general practices', edition: '5th edition' },
        coverage: { answered: 8, total: 20, percent: 40 },
        assessmentCoverage: { assessed: 9, total: 51, percent: 18 },
        readiness: { appearsReady: 2, assessed: 9, percent: 22 },
        statusCounts: { APPEARS_READY: 2, NEEDS_ATTENTION: 3, CONFIRMED_GAP: 1, NOT_CHECKED: 118 },
        requirements: [{
          id: 'R1',
          indicator: 'C7.1C',
          criterionDescription: 'Emergency response',
          plainEnglishRequirement: 'Maintain a documented emergency response process.',
          applicabilityStatus: 'APPLICABLE',
          applicabilityReason: 'Universal requirement.',
          readinessStatus: 'CONFIRMED_GAP',
          verificationStatus: 'USER_REPORTED',
          knownFacts: ['Current process is incomplete'],
          unknownFacts: ['Evidence still needs checking'],
          confirmedGaps: ['Documented process is missing'],
          potentialGaps: [],
          recommendedActions: ['Create and approve the process'],
          evidenceCount: 1,
        }],
      }
    },
    getAccreditationMissing: async ({ practiceId, cycleId }) => {
      calls.push(['missing', practiceId, cycleId])
      return { items: [{ requirementId: 'R1', indicator: 'C7.1C', reason: 'Evidence incomplete', priority: 'HIGH' }] }
    },
    listAccreditationActions: async ({ practiceId, cycleId }) => {
      calls.push(['actions', practiceId, cycleId])
      return { items: [{ id: 'a1', requirementId: 'R1', requirementIndicator: 'C7.1C', title: 'Finish emergency process', status: 'OPEN', priority: 'HIGH', dueDate: '2026-10-20' }] }
    },
    listAccreditationEvidence: async ({ practiceId, cycleId }) => {
      calls.push(['evidence', practiceId, cycleId])
      return [{
        id: 'e1',
        title: 'Emergency procedure',
        originalFilename: 'private-filename.pdf',
        storagePath: 'private/path/never-send.pdf',
        mappings: [{ requirementId: 'R1' }],
        assessments: [{ requirementId: 'R1', reviewStatus: 'INCOMPLETE', reason: 'Missing approval date.' }],
      }]
    },
    listAccreditationSources: async () => {
      calls.push(['sources'])
      return [{
        id: 'SRC-001',
        publisher: 'RACGP',
        title: 'Standards for general practices (5th edition)',
        url: 'https://www.racgp.org.au/standards',
        usedFor: 'Indicator content',
        verification: 'Checked 7 Oct 2026',
      }]
    },
  }
  const handler = createAskHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'practice_real' }),
    createServer: () => server,
    hashFn: async () => 'user_hash',
    generateAnswer: async () => { throw new Error('generic generator must not handle accreditation mode') },
    generateAccreditationAnswer: async (payload) => {
      generatedPayload = payload
      return {
        responseId: 'resp_a1',
        model: 'gpt-test',
        answer: { id: 'aa1', intro: 'Start here.', sections: [{ title: 'Priority', body: 'Fix C7.1C.', items: [] }], sources: [], relatedResources: [], relatedQuestions: [], risk: false, recommendation: null },
      }
    },
    processAskFn: async (input, deps) => {
      const generated = await deps.generateAnswer({ question: input.question, safetyIdentifier: input.actor.safetyIdentifier })
      return { statusCode: 200, body: { answer: generated.answer, conversationId: 'conv_1' } }
    },
  })

  const response = await handler(event({
    authorization: 'Bearer good',
    body: { question: 'What should we prioritise?', mode: 'accreditation', cycleId: 'client_cycle', practiceId: 'practice_evil' },
  }))
  assert.equal(response.statusCode, 200)
  assert.deepEqual(calls.slice(0, 6), [
    ['cycle', 'practice_real', 'client_cycle'],
    ['overview', 'practice_real', 'cycle_real'],
    ['missing', 'practice_real', 'cycle_real'],
    ['actions', 'practice_real', 'cycle_real'],
    ['evidence', 'practice_real', 'cycle_real'],
    ['sources'],
  ])
  assert.equal(generatedPayload.context.practiceId, undefined)
  assert.equal(generatedPayload.context.cycleId, 'cycle_real')
  assert.equal(generatedPayload.context.requirements[0].indicator, 'C7.1C')
  assert.equal(generatedPayload.context.requirements[0].plainEnglishRequirement, 'Maintain a documented emergency response process.')
  assert.equal(generatedPayload.context.requirements[0].applicabilityStatus, 'APPLICABLE')
  assert.equal(generatedPayload.context.evidence[0].title, 'Emergency procedure')
  assert.equal(generatedPayload.context.evidence[0].storagePath, undefined)
  assert.equal(generatedPayload.context.evidence[0].originalFilename, undefined)
  assert.equal(generatedPayload.resources[0].id, 'SRC-001')
})
