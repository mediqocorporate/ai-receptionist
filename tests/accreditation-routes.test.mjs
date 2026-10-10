import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderAccreditationPage } from '../src/components/accreditation.js'
import { renderShell } from '../src/components/shell.js'
import { ACCREDITATION_SUBROUTES, routeTitle } from '../src/data/routes.js'
import {
  accreditationPathForView,
  accreditationRequirementPath,
  parseAccreditationPath,
} from '../src/lib/accreditation-routes.js'

const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
const stylesSource = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

test('accreditation workspace views have stable browser routes', () => {
  assert.equal(accreditationPathForView('overview'), '/accreditation')
  assert.equal(accreditationPathForView('check'), '/accreditation/check')
  assert.equal(accreditationPathForView('comprehensive'), '/accreditation/comprehensive')
  assert.equal(accreditationPathForView('requirements'), '/accreditation/requirements')
  assert.equal(accreditationPathForView('evidence'), '/accreditation/evidence')
  assert.equal(accreditationPathForView('missing'), '/accreditation/missing')
  assert.equal(accreditationPathForView('actions'), '/accreditation/actions')
  assert.equal(accreditationPathForView('practice-information'), '/accreditation/practice-information')
  assert.equal(accreditationPathForView('explore'), '/accreditation/explore')
  assert.equal(accreditationPathForView('setup'), '/accreditation/setup')
})

test('accreditation routes parse trailing slashes and reject unrelated paths', () => {
  assert.deepEqual(parseAccreditationPath('/accreditation/requirements/'), { view: 'requirements', requirementIndicator: '' })
  assert.deepEqual(parseAccreditationPath('/accreditation/evidence'), { view: 'evidence', requirementIndicator: '' })
  assert.equal(parseAccreditationPath('/policies'), null)
  assert.equal(parseAccreditationPath('/accreditation/not-a-real-page'), null)
})

test('requirement routes use the RACGP indicator for deep links', () => {
  assert.equal(accreditationRequirementPath('GP3.1A'), '/accreditation/requirements/GP3.1A')
  assert.deepEqual(parseAccreditationPath('/accreditation/requirements/GP3.1A'), {
    view: 'requirement',
    requirementIndicator: 'GP3.1A',
  })
})

test('nested accreditation routes keep Accreditation Assistant active and expose navigable submenu links', () => {
  const html = renderShell({
    path: '/accreditation/requirements',
    content: '<main>requirements</main>',
    user: { firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager' },
    accreditationView: 'requirements',
  })
  assert.match(html, /sidebar-link active[^>]+href="\/accreditation"/)
  assert.match(html, /href="\/accreditation\/requirements"[^>]+data-nav="\/accreditation\/requirements"/)
  assert.equal(routeTitle('/accreditation/requirements/GP3.1A'), 'Accreditation Assistant')
})

test('accreditation workspace tabs link to their real routes', () => {
  const html = renderAccreditationPage({
    view: 'overview',
    overview: {
      cycle: { id: 'c1', targetAssessmentDate: null },
      standardVersion: { name: 'RACGP Standards for general practices', edition: '5th edition' },
      coverage: { answered: 0, total: 20, percent: 0 },
      assessmentCoverage: { assessed: 0, total: 51, percent: 0 },
      readiness: { appearsReady: 0, assessed: 0, percent: 0 },
      statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 0, NOT_CHECKED: 124 },
      requirements: [],
    },
  }, { signedIn: true, practiceName: 'Test Medical Centre' })
  assert.match(html, /href="\/accreditation\/requirements"[^>]+data-nav="\/accreditation\/requirements"/)
  assert.match(html, /href="\/accreditation\/evidence"[^>]+data-nav="\/accreditation\/evidence"/)
  assert.match(html, /href="\/accreditation\/actions"[^>]+data-nav="\/accreditation\/actions"/)
})

test('app resolves direct accreditation routes and browser back through the route loader', () => {
  assert.match(appSource, /parseAccreditationPath\(ui\.path\).*renderAccreditationPage/)
  assert.match(appSource, /async function loadAccreditationRoute\(\)/)
  assert.match(appSource, /openAccreditationRequirement\(requirement\.id, 'requirements', \{ syncPath: false \}\)/)
  assert.match(appSource, /updateAccreditationBrowserPath\(accreditationRequirementPath/)
  assert.match(appSource, /window\.addEventListener\('popstate',[\s\S]*loadAccreditationRoute\(\)/)
})


test('routed accreditation navigation keeps the existing button-like styling without link underlines', () => {
  assert.match(stylesSource, /\.accreditation-tab\s*\{[^}]*text-decoration:\s*none/s)
  assert.match(stylesSource, /\.accreditation-sidebar-item\s*\{[^}]*text-decoration:\s*none/s)
})


test('Team workspace is not exposed in Accreditation Assistant navigation', () => {
  assert.equal(ACCREDITATION_SUBROUTES.some((item) => item.view === 'team' || item.label === 'Team'), false)

  const html = renderShell({
    path: '/accreditation',
    content: '<main>overview</main>',
    user: { firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager' },
    accreditationView: 'overview',
  })
  assert.doesNotMatch(html, />Team</)
})
