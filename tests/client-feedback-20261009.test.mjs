import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderSignupDialog } from '../src/components/dialogs.js'
import { renderAccreditationSetup } from '../src/components/accreditation/setup.js'
import { renderRequirementsView } from '../src/components/accreditation/requirements.js'
import { renderRequirementDetail } from '../src/components/accreditation/requirement-detail.js'
import { renderPracticeInformation } from '../src/components/accreditation/practice-information.js'
import { renderAccreditationOverview } from '../src/components/accreditation/overview.js'
import { assessRequirement } from '../netlify/functions/_shared/accreditation-assessment.mjs'
import { effectiveRequirementState } from '../netlify/functions/_shared/accreditation-applicability.mjs'
import { createSupabaseServer } from '../netlify/functions/_shared/supabase-server.mjs'
import { createAccountSyncHandler } from '../netlify/functions/account-sync.mjs'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

test('signup CTA uses the client-approved Keep using MediQo for free wording', () => {
  const html = renderSignupDialog()
  assert.match(html, />Keep using MediQo for free</)
  assert.doesNotMatch(html, />Create account\s*</)
})

test('accreditation setup keeps the progress bar but removes step-count and developer-only copy', () => {
  const html = renderAccreditationSetup({
    step: 3,
    agencies: [
      { id: 'ACHS', name: 'Australian Council on Healthcare Standards (ACHS)' },
      { id: 'AGPAL', name: 'AGPAL Group of Companies' },
      { id: 'GLOBAL_MARK', name: 'Global Mark Pty Ltd' },
      { id: 'QPA', name: 'Quality Practice Accreditation (QPA)' },
    ],
  })
  assert.doesNotMatch(html, /Step 3 of 4/i)
  assert.doesNotMatch(html, /controlled by MediQo configuration|hard-coded into the app/i)
  for (const provider of ['Australian Council on Healthcare Standards', 'AGPAL Group of Companies', 'Global Mark Pty Ltd', 'Quality Practice Accreditation']) {
    assert.match(html, new RegExp(provider, 'i'))
  }
})

test('approved NGPA agencies are seeded as controlled configuration', () => {
  const migration = new URL('../supabase/migrations/202610100001_seed_accreditation_agencies.sql', import.meta.url)
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, 'utf8')
  for (const provider of ['Australian Council on Healthcare Standards', 'AGPAL Group of Companies', 'Global Mark Pty Ltd', 'Quality Practice Accreditation']) {
    assert.match(sql, new RegExp(provider, 'i'))
  }
})

test('requirements rows are the click target and internal implementation copy is hidden', () => {
  const html = renderRequirementsView([{
    id: 'R1',
    indicator: 'GP3.1A',
    criterionDescription: 'Qualifications, education and training of healthcare practitioners',
    classification: 'MANDATORY',
    classificationLabel: 'Mandatory',
    readinessStatus: 'NOT_CHECKED',
    verificationStatus: 'USER_REPORTED',
    evidenceCount: 0,
    quickCheckPriority: 'P1',
  }])
  assert.match(html, /<tr[^>]+data-accreditation-requirement="R1"/i)
  assert.doesNotMatch(html, />Open<\/button>/i)
  assert.doesNotMatch(html, /Readiness is supplied by the assessment engine|classification validation remains visible/i)
  assert.match(html, /No evidence yet/i)
})

test('requirement detail puts an interactive readiness question near the top and hides developer copy', () => {
  const html = renderRequirementDetail({
    id: 'R1',
    indicator: 'GP3.1A',
    criterion: 'GP3.1',
    criterionDescription: 'Qualifications, education and training of healthcare practitioners',
    classificationLabel: 'Mandatory',
    plainEnglishRequirement: 'Plain-English readiness assessment for qualifications.',
    readinessStatus: 'NOT_CHECKED',
    verificationStatus: 'USER_REPORTED',
    statusReason: 'Reported complete — evidence not yet checked.',
    knownFacts: [],
    unknownFacts: ['Supporting evidence has not yet been reviewed.'],
    potentialGaps: [],
    confirmedGaps: [],
    recommendedActions: ['Upload or confirm supporting evidence, then re-check this requirement.'],
    sourceUrls: {},
    evidenceCriteria: [{ evidenceType: 'Register', evidenceRule: 'Current practitioner register' }],
    questions: [{ id: 'Q1', wording: 'Have all practitioner registrations been checked?', answerOptions: ['Yes', 'No', "I'm not sure"] }],
    currentResponse: { questionId: 'Q1', answerLabel: 'Yes' },
  })
  assert.match(html, /data-accreditation-answer/)
  assert.match(html, /data-question-id="Q1"/)
  assert.match(html, /data-return-requirement-id="R1"/)
  assert.ok(html.indexOf('Have all practitioner registrations been checked?') < html.indexOf('Why MediQo shows this status'))
  assert.doesNotMatch(html, /Questions come from the controlled client dataset|Evidence types and assessment dimensions supplied by the workbook/i)
  assert.doesNotMatch(html, /Plain-English readiness assessment for/i)
})

test('Practice Information formats controlled values for people and supports inline editing', () => {
  const readHtml = renderPracticeInformation({
    facts: [
      { key: 'journey_status', label: 'Accreditation journey', value: 'NOT_SURE', provenance: 'Accreditation setup' },
      { key: 'assessment_date', label: 'Next assessment date', value: '2026-12-31', provenance: 'Accreditation setup' },
    ],
    values: { journeyStatus: 'NOT_SURE', targetAssessmentDate: '2026-12-31', gpCount: 6 },
    agencies: [],
  })
  assert.match(readHtml, />Not sure</)
  assert.match(readHtml, />31 Dec 2026</)
  assert.doesNotMatch(readHtml, />NOT_SURE</)

  const editHtml = renderPracticeInformation({
    facts: [],
    values: { journeyStatus: 'NOT_SURE', assessmentScheduled: 'UNKNOWN', gpCount: 6 },
    agencies: [],
  }, { editing: true })
  assert.match(editHtml, /data-accreditation-practice-information-form/)
  assert.match(editHtml, /name="journeyStatus"/)
  assert.match(editHtml, /name="gpCount"/)
  assert.match(editHtml, /Save & reassess/i)
})

test('positive user report is reported-complete, not a Needs Attention problem', () => {
  const result = assessRequirement({
    requirement: {
      id: 'R1', classification: 'MANDATORY', contentValidationStatus: 'VALIDATION_REQUIRED',
      active: true, applicability: 'Universal', plainEnglishRequirement: 'Maintain a current process.',
    },
    question: { id: 'Q1', wording: 'Is the process in place?' },
    response: { answerLabel: 'Yes' },
  })
  assert.equal(result.readinessStatus, 'NOT_CHECKED')
  assert.equal(result.verificationStatus, 'USER_REPORTED')
  assert.match(result.statusReason, /reported complete/i)
  assert.match(result.unknownFacts.join(' '), /evidence/i)
})

test('legacy positive user reports do not remain Needs Attention after the trust-rule update', () => {
  const result = effectiveRequirementState({
    requirement: { applicability_rule: 'Universal' },
    state: {
      applicability_status: 'APPLICABLE',
      readiness_status: 'NEEDS_ATTENTION',
      verification_status: 'USER_REPORTED',
      status_reason: 'Positive user report recorded; supporting evidence or verification is still required before this requirement can appear ready.',
      known_facts: [],
      unknown_facts: [],
      potential_gaps: [],
      confirmed_gaps: [],
    },
    response: { answer_label: 'Yes' },
    practiceContext: {},
  })
  assert.equal(result.readinessStatus, 'NOT_CHECKED')
  assert.match(result.statusReason, /reported complete/i)
  assert.match(result.unknownFacts.join(' '), /evidence/i)
})

test('overview separates assessment coverage, readiness and Quick Check progress and makes status numbers clickable', () => {
  const html = renderAccreditationOverview({
    cycle: { targetAssessmentDate: null },
    standardVersion: { name: 'RACGP Standards for general practices' },
    assessmentCoverage: { assessed: 18, total: 55, percent: 33 },
    readiness: { appearsReady: 0, assessed: 18, percent: 0 },
    coverage: { answered: 20, total: 20, percent: 100 },
    unresolvedApplicabilityCount: 7,
    statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 1, NOT_CHECKED: 123 },
    assessedCount: 18,
    nextAction: 'Address confirmed gap.',
  }, { practiceName: 'Test Medical Centre' })
  assert.match(html, /Assessment coverage/i)
  assert.match(html, /33%/)
  assert.match(html, /Readiness of assessed requirements/i)
  assert.match(html, /0%/)
  assert.match(html, /Quick Check.*20 of 20/is)
  assert.match(html, /7 requirements still need applicability confirmation/i)
  assert.match(html, /data-accreditation-filter="CONFIRMED_GAP"/)
})

test('overview server uses real linked evidence, reported responses for coverage, and profile-based vaccine applicability', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('accreditation_cycles?')) return json([{ id: 'c1', practice_id: 'p1', standard_version_id: 'RACGP5', status: 'ACTIVE' }])
    if (url.includes('accreditation_standard_versions?')) return json([{ id: 'RACGP5', code: 'RACGP5', name: 'RACGP Standards for general practices', edition: '5th edition', workspace_type: 'CURRENT' }])
    if (url.includes('accreditation_practice_profiles?')) return json([{ practice_id: 'p1', practice_context: { vaccinations: 'NO', vaccineStorage: 'NO' } }])
    if (url.includes('accreditation_requirements?')) return json([
      { id: 'R1', indicator: 'C1.1A', criterion_description: 'Universal', classification: 'MANDATORY', quick_check_priority: 'P1', applicability_rule: 'Universal', plain_english_requirement: 'Universal requirement', is_active: true },
      { id: 'RV', indicator: 'GP6.1A', criterion_description: 'Maintaining vaccine potency', classification: 'MANDATORY', quick_check_priority: 'P2', applicability_rule: 'Only if vaccines are stored', plain_english_requirement: 'Vaccine requirement', is_active: true },
    ])
    if (url.includes('accreditation_questions?')) return json([
      { id: 'Q1', requirement_id: 'R1', wording: 'Universal question?', why_we_ask: '' },
      { id: 'QV', requirement_id: 'RV', wording: 'Vaccine question?', why_we_ask: '' },
    ])
    if (url.includes('accreditation_answer_options?')) return json([{ question_id: 'Q1', option_order: 1, label: 'Yes' }])
    if (url.includes('accreditation_evidence_requirement_links?')) return json([])
    if (url.includes('accreditation_evidence_criteria?')) return json([])
    if (url.includes('practice_requirements?')) return json([
      { requirement_id: 'R1', applicability_status: 'APPLICABLE', readiness_status: 'NOT_CHECKED', verification_status: 'USER_REPORTED' },
      { requirement_id: 'RV', applicability_status: 'APPLICABLE', readiness_status: 'NEEDS_ATTENTION', verification_status: 'USER_REPORTED' },
    ])
    if (url.includes('readiness_responses?')) return json([{ requirement_id: 'R1', question_id: 'Q1', answer_label: 'Yes' }])
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const overview = await server.getAccreditationOverview({ practiceId: 'p1', cycleId: 'c1' })
  assert.deepEqual(overview.assessmentCoverage, { assessed: 1, total: 1, percent: 100 })
  assert.deepEqual(overview.readiness, { appearsReady: 0, assessed: 1, percent: 0 })
  assert.equal(overview.requirements.find((item) => item.id === 'R1').evidenceCount, 0)
  const vaccine = overview.requirements.find((item) => item.id === 'RV')
  assert.equal(vaccine.applicabilityStatus, 'NOT_APPLICABLE')
  assert.equal(vaccine.readinessStatus, 'NOT_CHECKED')
  assert.match(vaccine.applicabilityReason, /does not store vaccines/i)
})

test('account sync accepts the server-only HubSpot private app token name', async () => {
  let receivedToken = null
  const actor = { userId: 'u1', practiceId: 'p1', email: 'sarah@example.com', firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager', practiceName: 'Clinic' }
  const server = {
    claimAnonymous: async () => {},
    upsertCrmJob: async () => ({ id: 'job1' }),
    updateCrmJob: async () => {},
  }
  const handler = createAccountSyncHandler({
    env: { HUBSPOT_PRIVATE_APP_TOKEN: 'private-token' },
    authenticate: async () => actor,
    createServer: () => server,
    syncContact: async ({ token }) => { receivedToken = token; return { status: 'synced', contactId: 'hs1' } },
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' }, body: '{}' })
  assert.equal(response.statusCode, 200)
  assert.equal(receivedToken, 'private-token')
})

test('accreditation back controls use a left-pointing chevron', () => {
  const icons = fs.readFileSync(new URL('../src/components/icons.js', import.meta.url), 'utf8')
  const detail = fs.readFileSync(new URL('../src/components/accreditation/requirement-detail.js', import.meta.url), 'utf8')
  const wrapper = fs.readFileSync(new URL('../src/components/accreditation.js', import.meta.url), 'utf8')
  assert.match(icons, /'chevron-left'/)
  assert.match(detail, /icon\('chevron-left'/)
  assert.match(wrapper, /icon\('chevron-left'/)
})
