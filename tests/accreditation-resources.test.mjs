import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAccreditationResources } from '../netlify/functions/_shared/accreditation-resources.mjs'

test('controlled RACGP resources prefer criterion deep links over the generic standards PDF', () => {
  const resources = buildAccreditationResources({
    requirements: [{
      indicator: 'C7.1C',
      criterion: 'C7.1',
      criterionDescription: 'Content of patient health records',
    }],
  }, [{
    id: 'SRC-001',
    publisher: 'RACGP',
    title: 'Standards for general practices (5th edition)',
    url: 'https://www.racgp.org.au/getattachment/example/standards.aspx',
  }, {
    id: 'SRC-003',
    publisher: 'Australian Commission on Safety and Quality in Health Care',
    title: 'National General Practice Accreditation Scheme',
    url: 'https://www.safetyandquality.gov.au/example',
  }])

  assert.equal(resources.some((item) => item.id === 'SRC-001'), false)
  const criterion = resources.find((item) => item.id === 'RACGP-C7.1')
  assert.ok(criterion)
  assert.equal(criterion.title, 'Criterion C7.1 – Content of patient health records')
  assert.equal(
    criterion.url,
    'https://www.racgp.org.au/running-a-practice/practice-standards/standards-5th-edition/standards-for-general-practices-5th-ed/core-standards/core-standard-7/criterion-c7-1-content-of-patient-health-records',
  )
})
