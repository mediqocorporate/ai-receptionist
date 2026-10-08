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

test('comprehensive check selects unanswered verified mandatory requirements and keeps aspirational/unverified separate', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('accreditation_requirements?')) return json([
      { id: 'R1', classification: 'MANDATORY', is_active: true, quick_check_priority: 'P2', indicator: 'C1.1A', plain_english_requirement: 'Mandatory one' },
      { id: 'R2', classification: 'MANDATORY', is_active: true, quick_check_priority: 'P3', indicator: 'C1.1B', plain_english_requirement: 'Mandatory two' },
      { id: 'R3', classification: 'ASPIRATIONAL', is_active: true, quick_check_priority: 'P1', indicator: 'C1.1C', plain_english_requirement: 'Aspirational' },
      { id: 'R4', classification: 'UNVERIFIED', is_active: true, quick_check_priority: 'P1', indicator: 'C1.1D', plain_english_requirement: 'Unverified' },
    ])
    if (url.includes('accreditation_questions?')) return json([
      { id: 'Q1', requirement_id: 'R1', wording: 'Mandatory one?', why_we_ask: 'Why one' },
      { id: 'Q2', requirement_id: 'R2', wording: 'Mandatory two?', why_we_ask: 'Why two' },
      { id: 'Q3', requirement_id: 'R3', wording: 'Aspirational?', why_we_ask: 'Why' },
      { id: 'Q4', requirement_id: 'R4', wording: 'Unverified?', why_we_ask: 'Why' },
    ])
    if (url.includes('accreditation_answer_options?')) return json([
      { question_id: 'Q1', option_order: 1, label: 'Yes' },
      { question_id: 'Q2', option_order: 1, label: 'No' },
    ])
    if (url.includes('practice_requirements?')) return json([
      { requirement_id: 'R2', applicability_status: 'NOT_APPLICABLE' },
    ])
    if (url.includes('readiness_responses?')) return json([])
    throw new Error(`unexpected ${url}`)
  }

  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.getAccreditationComprehensiveCheck({ practiceId: 'p1', cycleId: 'c1' })

  assert.equal(result.coverage.total, 1)
  assert.equal(result.coverage.answered, 0)
  assert.equal(result.nextQuestion.id, 'Q1')
  assert.equal(result.nextQuestion.requirementId, 'R1')
  assert.equal(result.aspirationalCount, 1)
  assert.equal(result.classificationPendingCount, 1)
})

test('comprehensive check skips already answered mandatory questions', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('accreditation_requirements?')) return json([
      { id: 'R1', classification: 'MANDATORY', is_active: true, quick_check_priority: 'P1', indicator: 'C1.1A', plain_english_requirement: 'One' },
      { id: 'R2', classification: 'MANDATORY', is_active: true, quick_check_priority: 'P2', indicator: 'C1.1B', plain_english_requirement: 'Two' },
    ])
    if (url.includes('accreditation_questions?')) return json([
      { id: 'Q1', requirement_id: 'R1', wording: 'One?', why_we_ask: '' },
      { id: 'Q2', requirement_id: 'R2', wording: 'Two?', why_we_ask: '' },
    ])
    if (url.includes('accreditation_answer_options?')) return json([
      { question_id: 'Q1', option_order: 1, label: 'Yes' },
      { question_id: 'Q2', option_order: 1, label: 'Yes' },
    ])
    if (url.includes('practice_requirements?')) return json([])
    if (url.includes('readiness_responses?')) return json([{ question_id: 'Q1', requirement_id: 'R1' }])
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.getAccreditationComprehensiveCheck({ practiceId: 'p1', cycleId: 'c1' })
  assert.equal(result.coverage.answered, 1)
  assert.equal(result.coverage.total, 2)
  assert.equal(result.nextQuestion.id, 'Q2')
})
