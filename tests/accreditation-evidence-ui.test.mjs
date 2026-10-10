import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderAccreditationEvidence } from '../src/components/accreditation/evidence.js'
import { renderAccreditationPage } from '../src/components/accreditation.js'
import { renderRequirementDetail } from '../src/components/accreditation/requirement-detail.js'
import { ACCREDITATION_SUBROUTES } from '../src/data/routes.js'

const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
const stylesSource = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

const requirements = [
  { id: 'R1', indicator: 'C7.1C', criterionDescription: 'Patient health records', classificationLabel: 'Mandatory', applicabilityStatus: 'APPLICABLE' },
]

test('Evidence is a real Accreditation Assistant subroute', () => {
  assert.equal(ACCREDITATION_SUBROUTES.find((item) => item.view === 'evidence')?.available, true)
})

test('Evidence Library exposes approved formats, 25 MB/file, 50 files/batch and honest review language', () => {
  const html = renderAccreditationEvidence({
    items: [{
      id: 'e1',
      title: 'Privacy procedure',
      originalFilename: 'privacy.pdf',
      category: 'POLICY_PROCEDURE',
      status: 'ACTIVE',
      processingStatus: 'NOT_REVIEWED',
      mappings: [],
      assessments: [],
    }],
    uploading: false,
    error: '',
  }, { requirements })
  assert.match(html, /Evidence Library/i)
  assert.match(html, /type="file"[^>]*multiple/)
  assert.match(html, /\.pdf.*\.docx.*\.xlsx.*\.csv.*\.jpg.*\.jpeg.*\.png/i)
  assert.match(html, /25 MB/i)
  assert.match(html, /50 files/i)
  assert.match(html, /Not Reviewed/i)
  assert.match(html, /data-evidence-requirement/)
  assert.match(html, /data-action="evidence-link"/)
  assert.match(html, /data-action="evidence-download"/)
  assert.match(html, /data-action="evidence-supersede"/)
})

test('Evidence Library shows mapped requirement indicators and does not infer readiness from uploaded evidence', () => {
  const html = renderAccreditationEvidence({
    items: [{
      id: 'e1',
      title: 'Patient record audit',
      originalFilename: 'audit.pdf',
      category: 'AUDIT_REPORT',
      status: 'ACTIVE',
      processingStatus: 'NOT_REVIEWED',
      mappings: [{ requirementId: 'R1' }],
      assessments: [],
    }],
  }, { requirements })
  assert.match(html, /C7\.1C/)
  assert.match(html, /Not Reviewed/i)
  assert.doesNotMatch(html, /Appears Ready/i)
})

test('accreditation workspace renders Evidence and offers upload from an applicable requirement screen', () => {
  const html = renderAccreditationPage({
    view: 'evidence',
    overview: {
      setupRequired: false,
      cycle: { id: 'c1' },
      standardVersion: { name: 'RACGP Standards', edition: '5th edition' },
      coverage: { answered: 0, total: 20, percent: 0 },
      statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 0, NOT_CHECKED: 124 },
      assessedCount: 0,
      requirements,
    },
    evidence: { items: [], uploading: false, error: '', prefillRequirementId: '' },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.match(html, /href="\\/accreditation\\/evidence"/)
  assert.match(html, /Evidence Library/i)

  const detail = renderRequirementDetail({
    id: 'R1', indicator: 'C7.1C', criterion: 'C7.1', criterionDescription: 'Patient health records',
    classificationLabel: 'Mandatory', applicabilityStatus: 'APPLICABLE', readinessStatus: 'NOT_CHECKED',
    verificationStatus: 'USER_REPORTED', statusReason: 'More information required.', knownFacts: [], unknownFacts: [],
    potentialGaps: [], confirmedGaps: [], recommendedActions: [], sourceUrls: {}, evidenceCriteria: [],
    questions: [{ id: 'Q1', wording: 'Is this in place?', answerOptions: ['Yes','No'] }],
  })
  assert.match(detail, /Upload evidence/i)
  assert.match(detail, /data-action="evidence-upload-for-requirement"/)
  assert.match(detail, /data-requirement-id="R1"/)
})

test('app loads and mutates Evidence through the live service', () => {
  for (const pattern of [
    /accreditationEvidenceService\.list\(/,
    /accreditationEvidenceService\.uploadBatch\(/,
    /accreditationEvidenceService\.link\(/,
    /accreditationEvidenceService\.download\(/,
    /accreditationEvidenceService\.supersede\(/,
  ]) assert.match(appSource, pattern)
})


test('selected evidence files survive accreditation rerenders until upload completes', () => {
  assert.match(appSource, /evidence:\s*\{[^}]*selectedFiles:\s*\[\]/s)
  assert.match(appSource, /ui\.accreditation\.evidence\.selectedFiles\s*=\s*files/)
  assert.match(appSource, /const files = Array\.from\(ui\.accreditation\.evidence\.selectedFiles \|\| input\?\.files \|\| \[\]\)/)
  assert.match(appSource, /ui\.accreditation\.evidence\.selectedFiles\s*=\s*\[\]/)
})


test('Evidence Library renders real upload progress and an initial loading state', () => {
  const progressHtml = renderAccreditationEvidence({
    items: [],
    loaded: true,
    uploading: true,
    uploadProgress: {
      percent: 42,
      currentFilename: 'records.pdf',
      currentFileIndex: 1,
      totalFiles: 2,
    },
  }, { requirements })
  assert.match(progressHtml, /role="progressbar"/)
  assert.match(progressHtml, /42%/)
  assert.match(progressHtml, /1 of 2 files/i)
  assert.match(progressHtml, /records\.pdf/i)

  const loadingHtml = renderAccreditationEvidence({
    items: [],
    loaded: false,
    loading: false,
  }, { requirements })
  assert.match(loadingHtml, /Loading evidence/i)
  assert.doesNotMatch(loadingHtml, /No evidence uploaded yet/i)
})

test('requirement detail shows active mapped evidence without treating it as readiness', () => {
  const detail = renderRequirementDetail({
    id: 'R1', indicator: 'C7.1C', criterion: 'C7.1', criterionDescription: 'Patient health records',
    classificationLabel: 'Mandatory', applicabilityStatus: 'APPLICABLE', readinessStatus: 'CONFIRMED_GAP',
    verificationStatus: 'USER_REPORTED', statusReason: 'Gap confirmed.', knownFacts: [], unknownFacts: [],
    potentialGaps: [], confirmedGaps: ['Gap'], recommendedActions: [], sourceUrls: {}, evidenceCriteria: [],
    questions: [{ id: 'Q1', wording: 'Is this in place?', answerOptions: ['Yes','No'] }],
  }, {
    evidenceItems: [
      {
        id: 'active-evidence',
        title: 'Patient record audit',
        originalFilename: 'patient-record-audit.pdf',
        category: 'AUDIT_REPORT',
        status: 'ACTIVE',
        mappings: [{ requirementId: 'R1' }],
        assessments: [],
      },
      {
        id: 'old-evidence',
        title: 'Old audit',
        originalFilename: 'old-audit.pdf',
        category: 'AUDIT_REPORT',
        status: 'SUPERSEDED',
        mappings: [{ requirementId: 'R1' }],
        assessments: [],
      },
    ],
  })
  assert.match(detail, /Mapped evidence/i)
  assert.match(detail, /Patient record audit/i)
  assert.match(detail, /patient-record-audit\.pdf/i)
  assert.match(detail, /Audit \/ report/i)
  assert.match(detail, /Not Reviewed/i)
  assert.match(detail, /data-action="evidence-download"/)
  assert.doesNotMatch(detail, /Old audit/i)
  assert.match(detail, /Confirmed Gap/i)
})

test('app validates file selection immediately, clears stale errors and hardens first-attempt selection', () => {
  assert.match(appSource, /function handleEvidenceFileSelection\(/)
  assert.match(appSource, /validateEvidenceFiles\(files\)/)
  assert.match(appSource, /ui\.accreditation\.evidence\.error\s*=\s*''/)
  assert.match(appSource, /root\.addEventListener\('input'[\s\S]*handleEvidenceFileSelection\(evidenceInput\)/)
  assert.match(appSource, /root\.addEventListener\('change'[\s\S]*handleEvidenceFileSelection\(evidenceInput\)/)
})


test('hidden evidence upload errors do not render as an empty red bar', () => {
  assert.match(stylesSource, /\.accreditation-inline-error\[hidden\]\s*\{[^}]*display:\s*none/i)
})
