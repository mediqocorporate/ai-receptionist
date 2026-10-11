import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationHandler } from '../netlify/functions/accreditation.mjs'

function event(body = {}) {
  return {
    httpMethod: 'POST',
    headers: { authorization: 'Bearer example' },
    body: JSON.stringify(body),
  }
}

function overview() {
  return {
    cycle: { id: 'cycle_1', targetAssessmentDate: '2026-12-15' },
    assessmentCoverage: { assessed: 12, total: 51, percent: 24 },
    readiness: { appearsReady: 5, assessed: 12, percent: 42 },
    statusCounts: { APPEARS_READY: 5, NEEDS_ATTENTION: 4, CONFIRMED_GAP: 3, NOT_CHECKED: 39 },
    requirements: [{
      id: 'R1',
      indicator: 'C7.1C',
      criterion: 'C7.1',
      criterionDescription: 'Content of patient health records',
      readinessStatus: 'CONFIRMED_GAP',
      knownFacts: ['A gap is confirmed.'],
      unknownFacts: [],
      confirmedGaps: ['Consultation notes are incomplete.'],
      recommendedActions: ['Review record content.'],
    }],
  }
}

function serverFixture(calls) {
  return {
    getOrCreateAccreditationCycle: async (practiceId, cycleId) => {
      calls.push(['cycle', practiceId, cycleId])
      return { id: 'cycle_1' }
    },
    getAccreditationOverview: async (payload) => {
      calls.push(['overview', payload])
      return overview()
    },
    getAccreditationMissing: async (payload) => {
      calls.push(['missing', payload])
      return { items: [{ requirementId: 'R1', indicator: 'C7.1C', title: 'Patient records', reason: 'Missing evidence', priority: 'HIGH' }] }
    },
    listAccreditationActions: async (payload) => {
      calls.push(['actions', payload])
      return { items: [{ id: 'a1', title: 'Fix records', status: 'OPEN', priority: 'HIGH', overdue: true }], summary: { open: 1, inProgress: 0, blocked: 0, done: 0, overdue: 1 } }
    },
    listAccreditationEvidence: async (payload) => {
      calls.push(['evidence', payload])
      return [{ id: 'e1', title: 'Record audit', status: 'ACTIVE', mappings: [{ requirementId: 'R1' }], assessments: [{ requirementId: 'R1', reviewStatus: 'INCOMPLETE', reason: 'Needs more detail', recommendedAction: 'Update audit', humanReviewRequired: true }] }]
    },
    listAccreditationReadinessReports: async (payload) => {
      calls.push(['history', payload])
      return [{ id: 'report_1', generatedAt: '2026-10-10T01:00:00.000Z', coveragePercent: 20, statusCounts: { CONFIRMED_GAP: 2 }, generatedBy: 'Sarah Jones' }]
    },
    listAccreditationSources: async () => [{ id: 'SRC-001', publisher: 'RACGP', title: 'Standards', url: 'https://example.test/standards' }],
    saveAccreditationReadinessReport: async (payload) => {
      calls.push(['save', payload])
      return { id: 'report_2', generatedAt: '2026-10-11T01:00:00.000Z', reportPayload: payload.report, limitations: payload.limitations, sources: payload.sources }
    },
    getAccreditationReadinessReport: async (payload) => {
      calls.push(['detail', payload])
      return { id: payload.reportId, generatedAt: '2026-10-10T01:00:00.000Z', reportPayload: { executiveSummary: 'Saved review' }, limitations: [] }
    },
  }
}

test('readiness report live view and history are scoped to authenticated practice', async () => {
  const calls = []
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => serverFixture(calls),
  })
  const response = await handler(event({ action: 'readiness_report', cycleId: 'cycle_1', practiceId: 'other_practice' }))
  assert.equal(response.statusCode, 200)
  const body = JSON.parse(response.body)
  assert.equal(body.report.live.statusCounts.CONFIRMED_GAP, 3)
  assert.equal(body.report.live.actions.overdue, 1)
  assert.equal(body.report.live.evidenceFollowUpCount, 1)
  assert.equal(body.report.history[0].id, 'report_1')
  assert.deepEqual(calls.find(([name]) => name === 'history')[1], { practiceId: 'practice_1', cycleId: 'cycle_1' })
})

test('pre-accreditation review uses server state and persists an immutable snapshot', async () => {
  const calls = []
  let generatedInput
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => serverFixture(calls),
    generateReadinessReview: async (input) => {
      generatedInput = input
      return {
        model: 'model-test',
        responseId: 'response_1',
        review: {
          executiveSummary: 'Address the confirmed gap first.',
          priorityActions: ['Fix records'],
          confirmedGaps: ['C7.1C'],
          unresolvedChecks: [],
          evidenceFollowUps: ['Update audit'],
          strengths: [],
          limitations: ['This is not an accreditation decision.'],
          sourceIds: ['RACGP-C7.1'],
          sources: [{ id: 'RACGP-C7.1', title: 'Criterion C7.1', url: 'https://www.racgp.org.au/example' }],
        },
      }
    },
  })
  const response = await handler(event({ action: 'generate_readiness_report', cycleId: 'cycle_1', practiceId: 'other_practice' }))
  assert.equal(response.statusCode, 200)
  assert.equal(generatedInput.context.statusCounts.CONFIRMED_GAP, 3)
  assert.equal(generatedInput.context.evidence[0].assessments[0].reviewStatus, 'INCOMPLETE')
  assert.equal('storagePath' in generatedInput.context.evidence[0], false)
  const save = calls.find(([name]) => name === 'save')[1]
  assert.equal(save.practiceId, 'practice_1')
  assert.equal(save.userId, 'user_1')
  assert.equal(save.snapshot.statusCounts.CONFIRMED_GAP, 3)
  assert.equal(save.report.executiveSummary, 'Address the confirmed gap first.')
})

test('saved readiness review detail is scoped to authenticated practice and cycle', async () => {
  const calls = []
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => serverFixture(calls),
  })
  const response = await handler(event({ action: 'readiness_report_detail', cycleId: 'cycle_1', reportId: 'report_1', practiceId: 'other_practice' }))
  assert.equal(response.statusCode, 200)
  assert.deepEqual(calls.find(([name]) => name === 'detail')[1], { practiceId: 'practice_1', cycleId: 'cycle_1', reportId: 'report_1' })
})

test('failed AI generation does not persist a readiness review', async () => {
  const calls = []
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => serverFixture(calls),
    generateReadinessReview: async () => { throw new Error('generation failed') },
  })
  const response = await handler(event({ action: 'generate_readiness_report', cycleId: 'cycle_1' }))
  assert.equal(response.statusCode, 500)
  assert.equal(calls.some(([name]) => name === 'save'), false)
})
