import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const wrapperUrl = new URL('../src/components/accreditation.js', import.meta.url)
const overviewUrl = new URL('../src/components/accreditation/overview.js', import.meta.url)
const checkUrl = new URL('../src/components/accreditation/readiness-check.js', import.meta.url)
const requirementsUrl = new URL('../src/components/accreditation/requirements.js', import.meta.url)
const detailUrl = new URL('../src/components/accreditation/requirement-detail.js', import.meta.url)
const appUrl = new URL('../src/app.js', import.meta.url)

async function load(url) {
  if (!fs.existsSync(url)) return null
  return import(url.href)
}

const overview = {
  cycle: { id: 'c1', practiceId: 'p1', standardVersionId: 'RACGP5', status: 'ACTIVE', targetAssessmentDate: null },
  standardVersion: { id: 'RACGP5', name: 'RACGP Standards for general practices', edition: '5th edition', workspaceType: 'CURRENT' },
  coverage: { answered: 1, total: 20, percent: 5 },
  statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 1, CONFIRMED_GAP: 0, NOT_CHECKED: 123 },
  assessedCount: 1,
  totalRequirements: 124,
  nextQuestion: {
    id: 'Q1',
    requirementId: 'R1',
    wording: 'Do you have a current process?',
    whyWeAsk: 'This helps establish what is known.',
    answerOptions: ['Yes', 'Partly', 'No', "I'm not sure"],
    priority: 'P1',
  },
  nextAction: 'Continue the Quick Readiness Check.',
}

test('accreditation workspace modules exist', () => {
  for (const url of [overviewUrl, checkUrl, requirementsUrl, detailUrl]) assert.equal(fs.existsSync(url), true)
})

test('overview identifies RACGP 5th edition and separates coverage from readiness', async () => {
  const mod = await load(overviewUrl)
  assert.ok(mod)
  const html = mod.renderAccreditationOverview(overview, { practiceName: 'Riverside Medical Centre' })
  assert.match(html, /RACGP 5th edition/i)
  assert.match(html, /Quick Check coverage/i)
  assert.match(html, /5%/)
  assert.match(html, /Appears Ready/i)
  assert.match(html, /Needs Attention/i)
  assert.match(html, /Confirmed Gap/i)
  assert.match(html, /Not Checked/i)
  assert.doesNotMatch(html, />Ready</i)
  assert.doesNotMatch(html, /Action required|Expiring soon|certified|compliant|pass\/fail/i)
})

test('empty overview uses Not Checked/setup state rather than fake readiness percentage', async () => {
  const mod = await load(overviewUrl)
  assert.ok(mod)
  const html = mod.renderAccreditationOverview({
    ...overview,
    coverage: { answered: 0, total: 20, percent: 0 },
    assessedCount: 0,
    statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 0, NOT_CHECKED: 124 },
    nextAction: 'Start the Quick Readiness Check.',
  })
  assert.match(html, /Not Checked/i)
  assert.match(html, /Start the Quick Readiness Check/i)
  assert.doesNotMatch(html, /0% ready/i)
})

test("P1 Quick Check renders one server-selected question and I'm not sure option", async () => {
  const mod = await load(checkUrl)
  assert.ok(mod)
  const html = mod.renderReadinessCheck(overview)
  assert.match(html, /Do you have a current process\?/)
  assert.match(html, /I'm not sure/)
  assert.match(html, /data-accreditation-answer/)
  assert.match(html, /1 of 20|5%/i)
})

test('requirements view exposes approved filters and validation-required label', async () => {
  const mod = await load(requirementsUrl)
  assert.ok(mod)
  const html = mod.renderRequirementsView([
    {
      id: 'R1',
      indicator: 'C1.1A',
      criterionDescription: 'Practice information',
      classification: 'UNVERIFIED',
      classificationLabel: 'Validation required',
      readinessStatus: 'NOT_CHECKED',
      verificationStatus: null,
      quickCheckPriority: 'P1',
      criticalSafetyArea: true,
      evidenceCount: 2,
      lastAssessedAt: null,
    },
  ], { filter: 'ALL' })
  for (const label of ['All', 'Appears Ready', 'Needs Attention', 'Confirmed Gap', 'Not Checked', 'P1 priority', 'Critical safety']) {
    assert.match(html, new RegExp(label, 'i'))
  }
  assert.match(html, /Validation required/i)
  assert.doesNotMatch(html, /Action required|Expiring soon/i)
})

test('requirement detail renders server facts, evidence, source and next action without inferring readiness', async () => {
  const mod = await load(detailUrl)
  assert.ok(mod)
  const html = mod.renderRequirementDetail({
    id: 'R1',
    indicator: 'C1.1A',
    criterion: 'C1.1',
    criterionDescription: 'Practice information',
    classificationLabel: 'Mandatory',
    plainEnglishRequirement: 'Maintain current practice information.',
    readinessStatus: 'NEEDS_ATTENTION',
    verificationStatus: 'USER_REPORTED',
    statusReason: 'Evidence is still needed.',
    knownFacts: ['The practice reports the process is in place.'],
    unknownFacts: ['Current evidence has not been reviewed.'],
    potentialGaps: [],
    confirmedGaps: [],
    recommendedActions: ['Upload or verify supporting evidence.'],
    sourceUrls: { racgp: 'https://example.org/racgp' },
    evidenceCriteria: [{ evidenceType: 'Policy', evidenceRule: 'Current approved policy' }],
    questions: [{ id: 'Q1', wording: 'Is this in place?', answerOptions: ['Yes', 'No', "I'm not sure"] }],
    currentResponse: { answerLabel: 'Yes', answeredAt: '2026-10-09T00:00:00Z' },
  })
  assert.match(html, /Evidence is still needed/)
  assert.match(html, /Current evidence has not been reviewed/)
  assert.match(html, /Current approved policy/)
  assert.match(html, /https:\/\/example\.org\/racgp/)
  assert.match(html, /Upload or verify supporting evidence/)
})

test('accreditation wrapper is server-driven and does not import the old hard-coded demo dataset', async () => {
  const source = fs.readFileSync(wrapperUrl, 'utf8')
  assert.doesNotMatch(source, /data\/accreditation\.js/)
  assert.doesNotMatch(source, /Math\.round\(\(ready \/ items\.length\)/)
  assert.match(source, /renderAccreditationOverview/)
})


test('app loads and mutates accreditation through the live service rather than local overrides', () => {
  const source = fs.readFileSync(appUrl, 'utf8')
  assert.match(source, /accreditationService\.overview\(\)/)
  assert.match(source, /accreditationService\.answer\(/)
  assert.match(source, /accreditationService\.requirement\(/)
  assert.doesNotMatch(source, /function updateAccreditation\(/)
  assert.doesNotMatch(source, /accreditationOverrides\[select\.dataset\.accreditationId\]/)
})


test('legacy hard-coded accreditation dataset is removed from the browser bundle', () => {
  const legacy = new URL('../src/data/accreditation.js', import.meta.url)
  const reports = fs.readFileSync(new URL('../src/components/reports.js', import.meta.url), 'utf8')
  assert.equal(fs.existsSync(legacy), false)
  assert.doesNotMatch(reports, /data\/accreditation\.js/)
})


test('completed Quick Check does not invite the user to continue an already finished check', async () => {
  const mod = await load(overviewUrl)
  assert.ok(mod)
  const html = mod.renderAccreditationOverview({
    ...overview,
    coverage: { answered: 20, total: 20, percent: 100 },
    nextQuestion: null,
    nextAction: 'Review evidence for assessed requirements.',
  })
  assert.match(html, /Review Quick Check/i)
  assert.doesNotMatch(html, /Continue Quick Check/i)
})
