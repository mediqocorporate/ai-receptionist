import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderAccreditationEvidence } from '../src/components/accreditation/evidence.js'
import { renderAccreditationPage } from '../src/components/accreditation.js'

const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')

const requirements = [
  { id: 'R1', indicator: 'C7.1C', criterionDescription: 'Patient health records', classificationLabel: 'Mandatory' },
]

test('Evidence Library supports multiple files, category selection, mapping and honest Not Reviewed state', () => {
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
  assert.match(html, /POLICY_PROCEDURE|Policy \/ procedure/i)
  assert.match(html, /Not Reviewed/i)
  assert.match(html, /data-evidence-requirement/)
  assert.match(html, /data-action="evidence-link"/)
  assert.match(html, /data-action="evidence-download"/)
  assert.match(html, /data-action="evidence-supersede"/)
})

test('Evidence Library shows mapped requirement indicators and review status from the server', () => {
  const html = renderAccreditationEvidence({
    items: [{
      id: 'e1',
      title: 'Patient record audit',
      originalFilename: 'audit.pdf',
      category: 'AUDIT_REPORT',
      status: 'ACTIVE',
      processingStatus: 'COMPLETE',
      mappings: [{ requirementId: 'R1' }],
      assessments: [{ requirementId: 'R1', reviewStatus: 'INCOMPLETE' }],
    }],
  }, { requirements })
  assert.match(html, /C7\.1C/)
  assert.match(html, /Incomplete/i)
  assert.doesNotMatch(html, /Appears Ready/i)
})

test('accreditation workspace exposes Evidence as a real internal view', () => {
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
    evidence: { items: [], uploading: false, error: '' },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.match(html, /data-accreditation-view="evidence"/)
  assert.match(html, /Evidence Library/i)
})

test('app loads, uploads, links, downloads and supersedes evidence through the live service', () => {
  for (const pattern of [
    /accreditationEvidenceService\.list\(/,
    /accreditationEvidenceService\.upload\(/,
    /accreditationEvidenceService\.link\(/,
    /accreditationEvidenceService\.download\(/,
    /accreditationEvidenceService\.supersede\(/,
  ]) assert.match(appSource, pattern)
})
