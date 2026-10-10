import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderComprehensiveCheck } from '../src/components/accreditation/comprehensive-check.js'
import { renderAccreditationPage } from '../src/components/accreditation.js'

const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')

test('Comprehensive Check asks server-selected factual questions and clearly separates classification-pending rows', () => {
  const html = renderComprehensiveCheck({
    coverage: { answered: 4, total: 55, percent: 7 },
    nextQuestion: {
      id: 'Q1',
      requirementId: 'R1',
      indicator: 'C1.1A',
      wording: 'Does your practice have this process in place?',
      whyWeAsk: 'This establishes a practice fact.',
      answerOptions: ['Yes', 'No', "I'm not sure"],
    },
    aspirationalCount: 6,
    classificationPendingCount: 64,
  })
  assert.match(html, /Comprehensive Check/i)
  assert.match(html, /4 of 55/)
  assert.match(html, /Does your practice have this process in place\?/)
  assert.match(html, /I'm not sure/)
  assert.match(html, /64.*classification.*validation|classification.*64.*validation/i)
  assert.match(html, /data-check-mode="comprehensive"/)
  assert.doesNotMatch(html, /pass|fail|compliant|certified/i)
})

test('workspace exposes a functional Comprehensive Check tab once a cycle exists', () => {
  const html = renderAccreditationPage({
    view: 'comprehensive',
    overview: {
      setupRequired: false,
      cycle: { id: 'c1' },
      standardVersion: { name: 'RACGP Standards', edition: '5th edition' },
      coverage: { answered: 0, total: 20, percent: 0 },
      statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 0, NOT_CHECKED: 124 },
      assessedCount: 0,
      requirements: [],
    },
    comprehensive: {
      coverage: { answered: 0, total: 55, percent: 0 },
      nextQuestion: null,
      aspirationalCount: 6,
      classificationPendingCount: 64,
    },
  }, { signedIn: true, practiceName: 'Harbour Medical Centre' })
  assert.ok(html.includes('href="/accreditation/comprehensive"'))
  assert.match(html, /Comprehensive Check/i)
})

test('app loads comprehensive data and refreshes it after a comprehensive answer', () => {
  assert.match(appSource, /accreditationService\.comprehensiveCheck\(/)
  assert.match(appSource, /data\.checkMode|dataset\.checkMode/)
})
