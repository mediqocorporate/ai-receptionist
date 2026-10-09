import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderSignupDialog } from '../src/components/dialogs.js'
import { renderAccreditationPage } from '../src/components/accreditation.js'
import { renderRequirementsView } from '../src/components/accreditation/requirements.js'
import { renderRequirementDetail } from '../src/components/accreditation/requirement-detail.js'
import { assessRequirement } from '../netlify/functions/_shared/accreditation-assessment.mjs'
import { createSupabaseServer } from '../netlify/functions/_shared/supabase-server.mjs'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

test('accreditation back buttons keep the left chevron facing left', () => {
  const html = renderAccreditationPage({
    view: 'requirements',
    overview: { cycle: { id: 'c1' }, requirements: [] },
  }, { signedIn: true, practiceName: 'Test Medical Centre' })
  assert.match(html, /chevron-left/)
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.accreditation-page-back \.conversation-back \.icon[\s\S]*?\.requirement-back \.icon[\s\S]*?transform:\s*none/)
})

test('changing the same readiness answer replaces stale reported facts and does not duplicate gaps', () => {
  const requirement = {
    id: 'R1',
    classification: 'MANDATORY',
    contentValidationStatus: 'VERIFIED',
    active: true,
    applicability: 'Universal',
    plainEnglishRequirement: 'Content of patient health records',
  }
  const question = { id: 'Q1', wording: 'Do patient records contain consultation notes?' }

  const first = assessRequirement({ requirement, question, response: { answerLabel: 'No' } })
  const second = assessRequirement({ requirement, question, response: { answerLabel: 'Sometimes' }, previousState: first })
  const third = assessRequirement({ requirement, question, response: { answerLabel: 'Sometimes' }, previousState: second })

  assert.deepEqual(third.knownFacts, ['Do patient records contain consultation notes? — reported answer: Sometimes'])
  assert.deepEqual(third.potentialGaps, ['Content of patient health records'])
  assert.deepEqual(third.confirmedGaps, [])
})

test('Comprehensive Check coverage uses the same informative-answer definition as Overview', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('accreditation_requirements?')) return json([
      { id: 'R1', indicator: 'C1.1A', classification: 'MANDATORY', applicability_rule: 'Universal', is_active: true, quick_check_priority: 'P1' },
      { id: 'R2', indicator: 'C1.1B', classification: 'MANDATORY', applicability_rule: 'Universal', is_active: true, quick_check_priority: 'P2' },
      { id: 'R3', indicator: 'C1.1C', classification: 'MANDATORY', applicability_rule: 'Universal', is_active: true, quick_check_priority: 'P3' },
    ])
    if (url.includes('accreditation_questions?')) return json([
      { id: 'Q1', requirement_id: 'R1', wording: 'One?', is_active: true },
      { id: 'Q2', requirement_id: 'R2', wording: 'Two?', is_active: true },
      { id: 'Q3', requirement_id: 'R3', wording: 'Three?', is_active: true },
    ])
    if (url.includes('accreditation_answer_options?')) return json([
      { question_id: 'Q1', option_order: 1, label: 'Yes' },
      { question_id: 'Q2', option_order: 1, label: "I'm not sure" },
      { question_id: 'Q3', option_order: 1, label: 'No' },
    ])
    if (url.includes('practice_requirements?')) return json([])
    if (url.includes('readiness_responses?')) return json([
      { requirement_id: 'R1', question_id: 'Q1', answer_label: 'Yes', answered_at: '2026-10-10T01:00:00Z' },
      { requirement_id: 'R2', question_id: 'Q2', answer_label: "I'm not sure", answered_at: '2026-10-10T01:01:00Z' },
      { requirement_id: 'R3', question_id: 'Q3', answer_label: 'No', answered_at: '2026-10-10T01:02:00Z' },
    ])
    if (url.includes('accreditation_practice_profiles?')) return json([])
    throw new Error(`unexpected ${url}`)
  }

  const server = createSupabaseServer({ env, fetchImpl })
  const check = await server.getAccreditationComprehensiveCheck({ practiceId: 'p1', cycleId: 'c1' })

  assert.deepEqual(check.coverage, { answered: 2, total: 3, percent: 67 })
  assert.equal(check.nextQuestion, null)
})

test('Not Applicable requirements are visible in All but excluded from active critical-safety filtering', () => {
  const requirements = [
    {
      id: 'RV',
      indicator: 'GP6.1C',
      criterionDescription: 'Maintaining vaccine potency',
      classification: 'MANDATORY',
      classificationLabel: 'Mandatory',
      applicabilityStatus: 'NOT_APPLICABLE',
      applicabilityReason: 'Your practice has confirmed that it does not store vaccines onsite.',
      readinessStatus: 'NOT_CHECKED',
      verificationStatus: 'USER_REPORTED',
      evidenceCount: 0,
      quickCheckPriority: 'P1',
      criticalSafetyArea: true,
    },
    {
      id: 'RA',
      indicator: 'QI2.2E',
      criterionDescription: 'Safe and quality use of medicines',
      classification: 'MANDATORY',
      classificationLabel: 'Mandatory',
      applicabilityStatus: 'APPLICABLE',
      readinessStatus: 'NEEDS_ATTENTION',
      verificationStatus: 'USER_REPORTED',
      evidenceCount: 0,
      quickCheckPriority: 'P1',
      criticalSafetyArea: true,
    },
  ]

  const allHtml = renderRequirementsView(requirements, { filter: 'ALL' })
  assert.match(allHtml, /GP6\.1C/)
  assert.match(allHtml, /Not Applicable/i)

  const criticalHtml = renderRequirementsView(requirements, { filter: 'CRITICAL' })
  assert.doesNotMatch(criticalHtml, /GP6\.1C/)
  assert.match(criticalHtml, /QI2\.2E/)
})

test('Not Applicable requirement detail shows applicability reason and hides readiness and evidence controls', () => {
  const html = renderRequirementDetail({
    id: 'RV',
    indicator: 'GP6.1C',
    criterion: 'GP6.1',
    criterionDescription: 'Maintaining vaccine potency',
    classificationLabel: 'Mandatory',
    applicabilityStatus: 'NOT_APPLICABLE',
    applicabilityReason: 'Your practice has confirmed that it does not store vaccines onsite.',
    readinessStatus: 'NOT_CHECKED',
    verificationStatus: 'USER_REPORTED',
    statusReason: 'Your practice has confirmed that it does not store vaccines onsite.',
    knownFacts: ['Vaccine storage — No'],
    unknownFacts: [],
    potentialGaps: [],
    confirmedGaps: [],
    recommendedActions: [],
    sourceUrls: { racgp: 'https://www.racgp.org.au/' },
    evidenceCriteria: [{ evidenceType: 'Temperature logs', evidenceRule: 'Current logs' }],
    questions: [{ id: 'QV', wording: 'Does the practice store vaccines safely?', answerOptions: ['Yes', 'No'] }],
    currentResponse: { questionId: 'QV', answerLabel: 'Yes' },
  })

  assert.match(html, /Not Applicable/i)
  assert.match(html, /does not store vaccines onsite/i)
  assert.match(html, /data-accreditation-view="practice-information"/)
  assert.doesNotMatch(html, /data-accreditation-answer/)
  assert.doesNotMatch(html, /Possible evidence/i)
})

test('Overview readiness status counts exclude requirements whose applicability is not active', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('accreditation_cycles?')) return json([{ id: 'c1', practice_id: 'p1', standard_version_id: 'RACGP5', status: 'ACTIVE' }])
    if (url.includes('accreditation_standard_versions?')) return json([{ id: 'RACGP5', code: 'RACGP5', name: 'RACGP Standards for general practices', edition: '5th edition', workspace_type: 'CURRENT' }])
    if (url.includes('accreditation_practice_profiles?')) return json([{ practice_context: { vaccineStorage: 'NO', vaccinations: 'UNKNOWN' } }])
    if (url.includes('accreditation_requirements?')) return json([
      { id: 'R1', indicator: 'C1.1A', criterion_description: 'Universal', classification: 'MANDATORY', quick_check_priority: 'P1', applicability_rule: 'Universal', is_active: true },
      { id: 'RV', indicator: 'GP6.1C', criterion_description: 'Maintaining vaccine potency', classification: 'MANDATORY', quick_check_priority: 'P1', applicability_rule: 'Only if vaccines are stored', is_active: true },
    ])
    if (url.includes('accreditation_questions?')) return json([
      { id: 'Q1', requirement_id: 'R1', wording: 'Universal?', is_active: true },
      { id: 'QV', requirement_id: 'RV', wording: 'Vaccines?', is_active: true },
    ])
    if (url.includes('accreditation_answer_options?')) return json([])
    if (url.includes('accreditation_evidence_requirement_links?')) return json([])
    if (url.includes('practice_requirements?')) return json([])
    if (url.includes('readiness_responses?')) return json([])
    throw new Error(`unexpected ${url}`)
  }

  const server = createSupabaseServer({ env, fetchImpl })
  const overview = await server.getAccreditationOverview({ practiceId: 'p1', cycleId: 'c1' })

  assert.deepEqual(overview.statusCounts, {
    APPEARS_READY: 0,
    NEEDS_ATTENTION: 0,
    CONFIRMED_GAP: 0,
    NOT_CHECKED: 1,
  })
})

test('signup CTA has a stable scrollable footer layout with a right-aligned arrow', () => {
  const html = renderSignupDialog()
  assert.match(html, /<span>Keep using MediQo for free<\/span>/)
  assert.match(html, /signup-submit-arrow/)
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.signup-form-side\s*\{[^}]*overflow-y:\s*auto[^}]*max-height:/)
  assert.match(css, /\.gradient-submit\s*\{[^}]*justify-content:\s*space-between[^}]*padding:/)
  assert.match(css, /\.signup-submit-arrow/)
})
