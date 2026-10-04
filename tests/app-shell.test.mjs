import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_ROUTES, PRODUCT_ROUTES, routeTitle } from '../src/data/routes.js'
import { renderShell } from '../src/components/shell.js'

const demoUser = { firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager' }

test('navigation contains all required MediQo areas', () => {
  const labels = [...APP_ROUTES, ...PRODUCT_ROUTES].map((r) => r.label)
  assert.deepEqual(labels, [
    'Ask a Question',
    'Accreditation Assistant',
    'Policy Library',
    'Reports',
    'AI Receptionist',
    'Scribe',
    'Document Sorter',
    'Care Plan Generation',
    'MBS Billing Suggestions',
    'Telehealth',
    'Online Bookings',
  ])
})

test('anonymous shell includes MediQo identity and public top-bar actions without practice identity', () => {
  const html = renderShell({ path: '/', content: '<main>hello</main>' })
  assert.match(html, /MEDIQO|mediqo-logo/i)
  assert.match(html, /Connect your PMS/)
  assert.match(html, /Alerts/)
  assert.match(html, /Help/)
  assert.match(html, /Request a feature/)
  assert.doesNotMatch(html, /class="practice-selector"/)
  assert.doesNotMatch(html, /class="top-avatar"/)
})

test('route titles resolve required feature routes', () => {
  assert.equal(routeTitle('/'), 'Ask a Question')
  assert.equal(routeTitle('/accreditation'), 'Accreditation Assistant')
  assert.equal(routeTitle('/policies'), 'Policy Library')
  assert.equal(routeTitle('/reports'), 'Reports')
  assert.equal(routeTitle('/alerts'), 'Alerts Centre')
  assert.equal(routeTitle('/products/ai-receptionist'), 'AI Receptionist')
})

test('signed-in practice selector exposes an interactive practice menu action', () => {
  const html = renderShell({ path: '/', content: '<main>hello</main>', user: demoUser })
  assert.match(html, /data-action="toggle-practice-menu"/)
})

test('signed-in shell reflects the selected practice after account setup', () => {
  const html = renderShell({ path: '/', content: '<main>hello</main>', selectedPractice: 'Harbour Family Clinic', user: demoUser })
  assert.match(html, /Harbour Family Clinic/)
  assert.match(html, />HF</)
  assert.match(html, /Practice Manager/)
})
