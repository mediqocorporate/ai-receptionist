import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderAccreditationPage } from '../src/components/accreditation.js'

const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')

test('first accreditation visit offers setup or a clearly labelled fictional Explore route', () => {
  const html = renderAccreditationPage({
    view: 'overview',
    overview: { setupRequired: true, cycle: null, agencies: [] },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.match(html, /Let's get your practice ready for accreditation\./i)
  assert.match(html, /data-action="accreditation-start-setup"/)
  assert.match(html, /data-action="accreditation-explore"/)
  assert.match(html, /Explore Accreditation Assistant/i)
})

test('Explore Accreditation Assistant is clearly Example Practice data and has no save controls', () => {
  const html = renderAccreditationPage({
    view: 'explore',
    overview: { setupRequired: true, cycle: null, agencies: [] },
    exploreStep: 0,
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.match(html, /Example Practice/i)
  assert.match(html, /Riverside Medical Centre/)
  assert.match(html, /Readiness|Evidence|gap/i)
  assert.doesNotMatch(html, /data-accreditation-answer|data-action="save/i)
})

test('setup is a short guided wizard and allows unknown accreditation details', () => {
  const base = {
    view: 'setup',
    overview: { setupRequired: true, cycle: null, agencies: [{ id: 'agency_1', name: 'Example agency' }] },
  }
  const step1 = renderAccreditationPage({
    ...base,
    setup: { step: 1, values: {} },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.match(step1, /Set up your accreditation workspace/i)
  assert.match(step1, /Accreditation journey/i)
  assert.match(step1, /class="coverage-bar"/i)
  assert.match(step1, /journeyStatus/)
  assert.match(step1, /Not sure/i)

  const step2 = renderAccreditationPage({
    ...base,
    setup: { step: 2, values: { journeyStatus: 'NOT_SURE' } },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.match(step2, /assessmentScheduled/)
  assert.match(step2, /targetAssessmentDate/)
  assert.doesNotMatch(step2, /days remaining|countdown/i)

  const step3 = renderAccreditationPage({
    ...base,
    setup: { step: 3, values: {} },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.match(step3, /Accrediting agency/i)
  assert.match(step3, /Example agency/i)

  const step4 = renderAccreditationPage({
    ...base,
    setup: { step: 4, values: {} },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  for (const name of ['stateOrTerritory', 'locationsCount', 'gpCount', 'nursingWorkforce', 'alliedHealth', 'adminWorkforce', 'vaccinations', 'procedures', 'telehealth', 'pathologyCollection', 'pointOfCareTesting', 'vaccineStorage']) {
    assert.match(step4, new RegExp(`name="${name}"`))
  }
})

test('Practice Information shows the facts and provenance MediQo relies on', () => {
  const html = renderAccreditationPage({
    view: 'practice-information',
    overview: {
      setupRequired: false,
      cycle: { id: 'c1' },
      standardVersion: { name: 'RACGP Standards for general practices', edition: '5th edition' },
      coverage: { answered: 0, total: 20, percent: 0 },
      statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 0, NOT_CHECKED: 124 },
      assessedCount: 0,
      requirements: [],
    },
    practiceInformation: {
      facts: [
        { key: 'practice_name', label: 'Practice name', value: 'Harbour Medical Centre', provenance: 'MediQo account' },
        { key: 'assessment_date', label: 'Assessment date', value: null, provenance: 'Not provided' },
      ],
    },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.match(html, /Practice Information/)
  assert.match(html, /Harbour Medical Centre/)
  assert.match(html, /MediQo account/)
  assert.match(html, /Not provided/)
})

test('app wires setup, Explore and Practice Information through dedicated accreditation actions', () => {
  assert.match(appSource, /accreditationService\.setup\(/)
  assert.match(appSource, /accreditationService\.practiceInformation\(/)
  assert.match(appSource, /accreditation-start-setup/)
  assert.match(appSource, /accreditation-explore/)
})
