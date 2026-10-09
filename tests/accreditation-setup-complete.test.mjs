import test from 'node:test'
import assert from 'node:assert/strict'
import { renderShell } from '../src/components/shell.js'
import { renderAccreditationSetup } from '../src/components/accreditation/setup.js'
import { renderPracticeInformation } from '../src/components/accreditation/practice-information.js'
import { APP_ROUTES } from '../src/data/routes.js'
import { normalizeAccreditationSetup, buildAccreditationPracticeInformation } from '../netlify/functions/_shared/accreditation-setup.mjs'

test('Reports stays removed and Accreditation Assistant expands in the left navigation', () => {
  assert.equal(APP_ROUTES.some((route) => route.path === '/reports' || route.label === 'Reports'), false)
  const html = renderShell({
    path: '/accreditation',
    accreditationView: 'overview',
    user: { firstName: 'Imran', lastName: 'Gul', jobTitle: 'Practice Manager' },
  })
  for (const label of ['Overview', 'Quick Check', 'Comprehensive Check', 'Requirements', 'Evidence', 'Actions', 'Team', 'Ask Accreditation Assistant', 'Readiness Report', 'Practice Information']) {
    assert.match(html, new RegExp(label, 'i'))
  }
  assert.match(html, /What(?:&#039;|')s Missing/i)
  assert.match(html, /data-accreditation-view="overview"/)
  assert.match(html, /data-accreditation-view="check"/)
  assert.match(html, /data-accreditation-view="comprehensive"/)
  assert.match(html, /data-accreditation-view="requirements"/)
  assert.match(html, /data-accreditation-view="evidence"/)
  assert.match(html, /data-accreditation-view="practice-information"/)
  assert.doesNotMatch(html, /aria-disabled="true"[^>]*>Evidence</i)
})

test('setup completion offers all three client-specified starting paths now that Evidence is live', () => {
  const html = renderAccreditationSetup({ complete: true })
  assert.match(html, /Quick readiness check/i)
  assert.match(html, /Comprehensive readiness check/i)
  assert.match(html, /Upload my accreditation documents/i)
  assert.match(html, /data-accreditation-view="check"/)
  assert.match(html, /data-accreditation-view="comprehensive"/)
  assert.match(html, /data-accreditation-view="evidence"/)
  assert.doesNotMatch(html, /Upload my accreditation documents[\s\S]*disabled|disabled[\s\S]*Upload my accreditation documents/i)
})

test('Practice Information keeps provenance visible and provides an edit action', () => {
  const html = renderPracticeInformation({
    facts: [
      { key: 'practice_name', label: 'Practice name', value: 'Test Medical Centre', provenance: 'MediQo account' },
      { key: 'gp_count', label: 'Number of GPs', value: 6, provenance: 'Accreditation setup' },
    ],
  })
  assert.match(html, /MediQo account/)
  assert.match(html, /Accreditation setup/)
  assert.match(html, /Edit Practice Information/i)
  assert.match(html, /data-action="accreditation-edit-practice-information"/)
})

test('setup normalization stores only supported practice facts and preserves unknowns', () => {
  const result = normalizeAccreditationSetup({
    journeyStatus: 'CURRENTLY_ACCREDITED',
    assessmentScheduled: null,
    targetAssessmentDate: '2099-01-01',
    accreditingAgencyId: '',
    practiceContext: {
      stateOrTerritory: 'NSW',
      practiceType: 'General practice',
      locationsCount: '2',
      gpCount: '6',
      nursingWorkforce: '',
      alliedHealth: '3',
      adminWorkforce: '5',
      vaccinations: 'YES',
      procedures: 'UNKNOWN',
      telehealth: 'NO',
      pathologyCollection: 'YES',
      pointOfCareTesting: 'UNKNOWN',
      vaccineStorage: 'YES',
      services: 'General practice',
      notes: 'Reaccreditation',
      ignored: 'do not persist',
    },
  })
  assert.equal(result.journeyStatus, 'CURRENTLY_ACCREDITED')
  assert.equal(result.assessmentScheduled, null)
  assert.equal(result.targetAssessmentDate, null)
  assert.equal(result.accreditingAgencyId, null)
  assert.deepEqual(result.practiceContext, {
    stateOrTerritory: 'NSW',
    practiceType: 'General practice',
    locationsCount: 2,
    gpCount: 6,
    nursingWorkforce: null,
    alliedHealth: 3,
    adminWorkforce: 5,
    vaccinations: 'YES',
    procedures: 'UNKNOWN',
    telehealth: 'NO',
    pathologyCollection: 'YES',
    pointOfCareTesting: 'UNKNOWN',
    vaccineStorage: 'YES',
    services: 'General practice',
    notes: 'Reaccreditation',
  })
})

test('practice information builder returns editable values, sources and controlled agencies', () => {
  const info = buildAccreditationPracticeInformation({
    practice: { name: 'Test Medical Centre', jurisdictions: ['VIC'], practice_type: 'Clinic' },
    profile: {
      journey_status: 'REACCREDITATION',
      assessment_scheduled: true,
      accrediting_agency_id: 'agency_1',
      practice_context: { gpCount: 5, vaccinations: 'YES', stateOrTerritory: 'NSW' },
    },
    cycle: { target_assessment_date: '2027-03-01' },
    agencies: [{ id: 'agency_1', name: 'Agency One' }],
  })
  assert.equal(info.values.journeyStatus, 'REACCREDITATION')
  assert.equal(info.values.stateOrTerritory, 'NSW')
  assert.equal(info.values.targetAssessmentDate, '2027-03-01')
  assert.deepEqual(info.agencies, [{ id: 'agency_1', name: 'Agency One' }])
  assert.equal(info.facts.find((fact) => fact.key === 'state_or_territory').provenance, 'Accreditation setup')
  assert.equal(info.facts.find((fact) => fact.key === 'gp_count').value, 5)
})
