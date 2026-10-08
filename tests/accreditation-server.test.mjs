import test from 'node:test'
import assert from 'node:assert/strict'
import { createSupabaseServer } from '../netlify/functions/_shared/supabase-server.mjs'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

test('accreditation cycle lookup and creation are scoped by practice', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null })
    if (options.method === 'GET') return json([])
    return json([{ id: 'cycle_1', practice_id: 'practice_1', standard_version_id: 'RACGP5', status: 'ACTIVE' }])
  }
  const server = createSupabaseServer({ env, fetchImpl })
  assert.equal(typeof server.getOrCreateAccreditationCycle, 'function')
  const cycle = await server.getOrCreateAccreditationCycle('practice_1')
  assert.equal(cycle.id, 'cycle_1')
  assert.match(calls[0].url, /practice_id=eq\.practice_1/)
  assert.match(calls[0].url, /standard_version_id=eq\.RACGP5/)
  assert.equal(calls[1].body[0].practice_id, 'practice_1')
})

test('practice requirement reads always include practice and cycle filters', async () => {
  let calledUrl = ''
  const server = createSupabaseServer({
    env,
    fetchImpl: async (url) => { calledUrl = url; return json([]) },
  })
  assert.equal(typeof server.getPracticeRequirement, 'function')
  await server.getPracticeRequirement({ practiceId: 'p1', cycleId: 'c1', requirementId: 'R1' })
  assert.match(calledUrl, /practice_id=eq\.p1/)
  assert.match(calledUrl, /cycle_id=eq\.c1/)
  assert.match(calledUrl, /requirement_id=eq\.R1/)
})

test('saving readiness response never accepts a client practice id outside server payload', async () => {
  const calls = []
  const server = createSupabaseServer({
    env,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null })
      if (options.method === 'PATCH') return json([])
      return json([{ id: 'resp_1' }])
    },
  })
  assert.equal(typeof server.saveReadinessResponse, 'function')
  await server.saveReadinessResponse({
    practiceId: 'practice_1',
    cycleId: 'cycle_1',
    requirementId: 'R1',
    questionId: 'Q1',
    userId: 'user_1',
    answerLabel: 'Yes',
    answerDetail: {},
    verificationStatus: 'USER_REPORTED',
  })
  const insert = calls.find((call) => call.options.method === 'POST')
  assert.equal(insert.body[0].practice_id, 'practice_1')
  assert.equal(insert.body[0].user_id, 'user_1')
})

test('practice assessment upsert is keyed to authenticated practice and cycle', async () => {
  let call
  const server = createSupabaseServer({
    env,
    fetchImpl: async (url, options = {}) => {
      call = { url, options, body: JSON.parse(options.body) }
      return json([{ id: 'pr_1' }])
    },
  })
  assert.equal(typeof server.upsertPracticeRequirementAssessment, 'function')
  await server.upsertPracticeRequirementAssessment({
    practiceId: 'p1',
    cycleId: 'c1',
    requirementId: 'R1',
    assessment: {
      applicabilityStatus: 'APPLICABLE',
      readinessStatus: 'NEEDS_ATTENTION',
      verificationStatus: 'USER_REPORTED',
      confidence: 0.4,
      statusReason: 'Evidence needed.',
      knownFacts: [],
      unknownFacts: [],
      potentialGaps: [],
      confirmedGaps: [],
      recommendedActions: [],
      requiresReassessment: true,
    },
  })
  assert.match(call.url, /on_conflict=cycle_id,requirement_id/)
  assert.equal(call.body[0].practice_id, 'p1')
  assert.equal(call.body[0].cycle_id, 'c1')
  assert.equal(call.body[0].readiness_status, 'NEEDS_ATTENTION')
})


test('overview returns presentation-ready requirements and defaults unassessed rows to NOT_CHECKED', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('accreditation_cycles?')) return json([{ id: 'c1', practice_id: 'p1', standard_version_id: 'RACGP5', status: 'ACTIVE', started_at: '2026-10-09T00:00:00Z' }])
    if (url.includes('accreditation_standard_versions?')) return json([{ id: 'RACGP5', code: 'RACGP5', name: 'RACGP Standards for general practices', edition: '5th edition', workspace_type: 'CURRENT' }])
    if (url.includes('accreditation_requirements?')) return json([
      { id: 'R1', indicator: 'C1.1A', criterion_description: 'One', classification: 'UNVERIFIED', quick_check_priority: 'P1', critical_safety_area: true, plain_english_requirement: 'One requirement' },
      { id: 'R2', indicator: 'C1.1B', criterion_description: 'Two', classification: 'MANDATORY', quick_check_priority: 'P1', critical_safety_area: false, plain_english_requirement: 'Two requirement' },
    ])
    if (url.includes('accreditation_questions?')) return json([{ id: 'Q1', requirement_id: 'R1', wording: 'Question?', quick_check_priority: 'P1', why_we_ask: 'Why' }])
    if (url.includes('accreditation_answer_options?')) return json([{ question_id: 'Q1', option_order: 1, label: "I'm not sure" }])
    if (url.includes('accreditation_evidence_criteria?')) return json([{ requirement_id: 'R1', evidence_type: 'Policy' }, { requirement_id: 'R1', evidence_type: 'Register' }])
    if (url.includes('practice_requirements?')) return json([{ requirement_id: 'R1', readiness_status: 'NEEDS_ATTENTION', verification_status: 'USER_REPORTED', last_assessed_at: '2026-10-09T00:00:00Z' }])
    if (url.includes('readiness_responses?')) return json([])
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const overview = await server.getAccreditationOverview({ practiceId: 'p1', cycleId: 'c1' })
  assert.equal(overview.requirements.length, 2)
  assert.equal(overview.requirements[0].classificationLabel, 'Validation required')
  assert.equal(overview.requirements[0].readinessStatus, 'NEEDS_ATTENTION')
  assert.equal(overview.requirements[0].evidenceCount, 2)
  assert.equal(overview.requirements[1].readinessStatus, 'NOT_CHECKED')
  assert.equal(overview.statusCounts.NOT_CHECKED, 1)
})


test('overview selects the next question from P1 requirement priority even if question priority metadata drifts', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('accreditation_cycles?')) return json([{ id: 'c1', practice_id: 'p1', standard_version_id: 'RACGP5', status: 'ACTIVE', started_at: '2026-10-09T00:00:00Z' }])
    if (url.includes('accreditation_standard_versions?')) return json([{ id: 'RACGP5', code: 'RACGP5', name: 'RACGP Standards for general practices', edition: '5th edition', workspace_type: 'CURRENT' }])
    if (url.includes('accreditation_requirements?')) return json([
      { id: 'R1', indicator: 'C1.1A', criterion_description: 'One', classification: 'MANDATORY', quick_check_priority: 'P1', critical_safety_area: false, plain_english_requirement: 'One requirement' },
    ])
    if (url.includes('accreditation_questions?')) return json([
      { id: 'Q1', requirement_id: 'R1', wording: 'Question?', quick_check_priority: 'P2', why_we_ask: 'Why' },
    ])
    if (url.includes('accreditation_answer_options?')) return json([{ question_id: 'Q1', option_order: 1, label: 'Yes' }])
    if (url.includes('accreditation_evidence_criteria?')) return json([])
    if (url.includes('practice_requirements?')) return json([])
    if (url.includes('readiness_responses?')) return json([])
    throw new Error(`unexpected ${url}`)
  }

  const server = createSupabaseServer({ env, fetchImpl })
  const overview = await server.getAccreditationOverview({ practiceId: 'p1', cycleId: 'c1' })

  assert.equal(overview.coverage.answered, 0)
  assert.equal(overview.coverage.total, 1)
  assert.equal(overview.nextQuestion?.id, 'Q1')
  assert.equal(overview.nextQuestion?.priority, 'P1')
})
