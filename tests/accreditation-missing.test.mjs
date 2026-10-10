import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { ACCREDITATION_SUBROUTES } from '../src/data/routes.js'
import { renderAccreditationPage } from '../src/components/accreditation.js'
import { createAccreditationService } from '../src/services/accreditation-service.js'
import { createAccreditationHandler } from '../netlify/functions/accreditation.mjs'

const missingLogicUrl = new URL('../netlify/functions/_shared/accreditation-missing.mjs', import.meta.url)
const missingUiUrl = new URL('../src/components/accreditation/missing.js', import.meta.url)
const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

function event(body = {}, authorization = 'Bearer good') {
  return { httpMethod: 'POST', headers: authorization ? { authorization } : {}, body: JSON.stringify(body) }
}

async function loadMissingLogic() {
  if (!fs.existsSync(missingLogicUrl)) return null
  return import(missingLogicUrl.href)
}

async function loadMissingUi() {
  if (!fs.existsSync(missingUiUrl)) return null
  return import(missingUiUrl.href)
}

test("What's Missing is activated as the next client workflow section", () => {
  assert.equal(ACCREDITATION_SUBROUTES.find((item) => item.view === 'missing')?.available, true)
})

test("server gap builder keeps unknown separate from confirmed gaps and does not infer readiness from evidence", async () => {
  const mod = await loadMissingLogic()
  assert.ok(mod)
  const result = mod.buildAccreditationMissing({
    requirements: [
      {
        id: 'gap', indicator: 'C7.1C', criterionDescription: 'Patient health records', classificationLabel: 'Mandatory',
        applicabilityStatus: 'APPLICABLE', readinessStatus: 'CONFIRMED_GAP', verificationStatus: 'USER_REPORTED',
        criticalSafetyArea: false, quickCheckPriority: 'P1', assessmentInformative: true,
        statusReason: 'The practice explicitly reported that the requirement is not in place.',
        recommendedActions: ['Address the confirmed gap and re-check this requirement.'],
      },
      {
        id: 'positive', indicator: 'C1.1A', criterionDescription: 'Practice information', classificationLabel: 'Mandatory',
        applicabilityStatus: 'APPLICABLE', readinessStatus: 'NOT_CHECKED', verificationStatus: 'USER_REPORTED',
        criticalSafetyArea: false, quickCheckPriority: 'P1', assessmentInformative: true,
        statusReason: 'Reported complete; supporting evidence has not yet been reviewed.', recommendedActions: [],
      },
      {
        id: 'unknown', indicator: 'C2.1A', criterionDescription: 'Unknown fact', classificationLabel: 'Mandatory',
        applicabilityStatus: 'APPLICABLE', readinessStatus: 'NOT_CHECKED', verificationStatus: 'USER_REPORTED',
        criticalSafetyArea: false, quickCheckPriority: 'P2', assessmentInformative: false,
        statusReason: 'More information is required.', recommendedActions: [],
      },
      {
        id: 'na', indicator: 'GP6.1B', criterionDescription: 'Vaccine storage', classificationLabel: 'Mandatory',
        applicabilityStatus: 'NOT_APPLICABLE', readinessStatus: 'NOT_CHECKED', verificationStatus: 'USER_REPORTED',
        criticalSafetyArea: true, quickCheckPriority: 'P1', assessmentInformative: false,
      },
      {
        id: 'reviewed', indicator: 'C3.1A', criterionDescription: 'Reviewed evidence', classificationLabel: 'Mandatory',
        applicabilityStatus: 'APPLICABLE', readinessStatus: 'NOT_CHECKED', verificationStatus: 'USER_REPORTED',
        criticalSafetyArea: false, quickCheckPriority: 'P2', assessmentInformative: true,
        statusReason: 'Reported complete.', recommendedActions: [],
      },
    ],
    evidenceCriteria: [
      { requirementId: 'positive', evidenceType: 'Policy / procedure', evidenceRule: 'Current approved policy' },
      { requirementId: 'reviewed', evidenceType: 'Audit / report', evidenceRule: 'Current audit' },
    ],
    evidence: [
      {
        id: 'e-reviewed', status: 'ACTIVE', title: 'Current audit', category: 'AUDIT_REPORT',
        mappings: [{ requirementId: 'reviewed' }],
        assessments: [{ requirementId: 'reviewed', reviewStatus: 'SUFFICIENT_FOR_REVIEW' }],
      },
    ],
    actions: [],
  })

  assert.equal(result.items.some((item) => item.requirementId === 'na'), false)
  const gap = result.items.find((item) => item.requirementId === 'gap')
  assert.ok(gap.issueCodes.includes('CONFIRMED_GAP'))
  const positive = result.items.find((item) => item.requirementId === 'positive')
  assert.ok(positive.issueCodes.includes('MISSING_POLICY'))
  assert.equal(positive.issueCodes.includes('CONFIRMED_GAP'), false)
  const unknown = result.items.find((item) => item.requirementId === 'unknown')
  assert.deepEqual(unknown.issueCodes, ['NOT_CHECKED'])
  const reviewed = result.items.find((item) => item.requirementId === 'reviewed')
  assert.equal(reviewed, undefined)
  assert.equal(result.summary.confirmedGaps, 1)
  assert.equal(result.summary.notChecked, 1)
})

test("evidence review outcomes are surfaced honestly as incomplete, outdated or pending review", async () => {
  const mod = await loadMissingLogic()
  assert.ok(mod)
  const baseRequirement = {
    classificationLabel: 'Mandatory', applicabilityStatus: 'APPLICABLE', readinessStatus: 'NOT_CHECKED',
    verificationStatus: 'USER_REPORTED', criticalSafetyArea: false, quickCheckPriority: 'P1', assessmentInformative: true,
    statusReason: 'Reported complete.', recommendedActions: [],
  }
  const result = mod.buildAccreditationMissing({
    requirements: [
      { ...baseRequirement, id: 'old', indicator: 'C1', criterionDescription: 'Old policy' },
      { ...baseRequirement, id: 'partial', indicator: 'C2', criterionDescription: 'Incomplete register' },
      { ...baseRequirement, id: 'pending', indicator: 'C3', criterionDescription: 'Pending evidence' },
    ],
    evidenceCriteria: [],
    evidence: [
      { id: 'e1', status: 'ACTIVE', mappings: [{ requirementId: 'old' }], assessments: [{ requirementId: 'old', reviewStatus: 'OUTDATED', recommendedAction: 'Upload the current version.' }] },
      { id: 'e2', status: 'ACTIVE', mappings: [{ requirementId: 'partial' }], assessments: [{ requirementId: 'partial', reviewStatus: 'INCOMPLETE', recommendedAction: 'Add the missing pages.' }] },
      { id: 'e3', status: 'ACTIVE', mappings: [{ requirementId: 'pending' }], assessments: [] },
    ],
    actions: [],
  })
  assert.ok(result.items.find((item) => item.requirementId === 'old').issueCodes.includes('EVIDENCE_OUTDATED'))
  assert.ok(result.items.find((item) => item.requirementId === 'partial').issueCodes.includes('EVIDENCE_INCOMPLETE'))
  assert.ok(result.items.find((item) => item.requirementId === 'pending').issueCodes.includes('EVIDENCE_REVIEW_PENDING'))
})

test("What's Missing UI prioritises gaps and summarises unchecked work without calling unknown a confirmed gap", async () => {
  const mod = await loadMissingUi()
  assert.ok(mod)
  const html = mod.renderAccreditationMissing({
    summary: { totalItems: 8, confirmedGaps: 1, needsAttention: 1, evidenceIssues: 2, applicabilityToConfirm: 1, notChecked: 3 },
    items: [
      { requirementId: 'R1', indicator: 'C7.1C', title: 'Patient health records', priority: 'HIGH', issueCodes: ['CONFIRMED_GAP'], whyShown: 'The practice reported this is not in place.', nextAction: 'Address the gap.', expectedEvidence: [], ownerName: '', dueDate: null },
      { requirementId: 'R2', indicator: 'C1.1A', title: 'Practice information', priority: 'HIGH', issueCodes: ['MISSING_POLICY'], whyShown: 'No active supporting evidence is mapped.', nextAction: 'Upload or map evidence.', expectedEvidence: [{ type: 'Policy / procedure', rule: 'Current approved policy' }], ownerName: '', dueDate: null },
      { requirementId: 'R3', indicator: 'C2.1A', title: 'Needs checking', priority: 'LOW', issueCodes: ['NOT_CHECKED'], whyShown: 'This requirement has not been assessed yet.', nextAction: 'Complete the readiness question.', expectedEvidence: [], ownerName: '', dueDate: null },
    ],
  })
  assert.match(html, /What(?:’|')s Missing/i)
  assert.match(html, /Confirmed gap/i)
  assert.match(html, /Missing policy/i)
  assert.match(html, /Still to check/i)
  assert.match(html, /Unknown information is not treated as a confirmed gap/i)
  assert.match(html, /Current approved policy/i)
  assert.match(html, /data-accreditation-requirement="R1"/)
})

test("accreditation browser service requests the server-owned missing-workspace result", async () => {
  const payloads = []
  const service = createAccreditationService({
    config: { accreditationApiUrl: '/api/accreditation' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (_url, init) => {
      payloads.push(JSON.parse(init.body))
      return response(200, { missing: { summary: { totalItems: 0 }, items: [] }, cycleId: 'c1' })
    },
  })
  const result = await service.missing({ cycleId: 'c1' })
  assert.deepEqual(payloads[0], { action: 'missing', cycleId: 'c1' })
  assert.deepEqual(result.items, [])
})

test("missing endpoint is scoped to the authenticated practice and cycle", async () => {
  const calls = []
  const server = {
    getOrCreateAccreditationCycle: async (practiceId, cycleId) => ({ id: cycleId || 'c1', practice_id: practiceId }),
    getAccreditationMissing: async (payload) => { calls.push(payload); return { summary: { totalItems: 0 }, items: [] } },
  }
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'practice_1' }),
    createServer: () => server,
  })
  const result = await handler(event({ action: 'missing', cycleId: 'c1', practiceId: 'evil' }))
  assert.equal(result.statusCode, 200)
  assert.deepEqual(calls[0], { practiceId: 'practice_1', cycleId: 'c1' })
})

test("workspace wrapper and app load What's Missing from the backend", () => {
  const html = renderAccreditationPage({
    view: 'missing',
    overview: { setupRequired: false, cycle: { id: 'c1' }, requirements: [] },
    missing: { data: { summary: { totalItems: 0, confirmedGaps: 0, needsAttention: 0, evidenceIssues: 0, applicabilityToConfirm: 0, notChecked: 0 }, items: [] }, loading: false, error: '' },
  }, { signedIn: true, practiceName: 'Test Medical Centre' })
  assert.match(html, /data-accreditation-view="missing"/)
  assert.match(html, /What(?:’|')s Missing/i)
  assert.match(appSource, /accreditationService\.missing\(/)
})
