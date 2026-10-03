import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_ROUTES, PRODUCT_ROUTES, routeTitle } from '../src/data/routes.js'
import { renderShell } from '../src/components/shell.js'

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

test('shell includes MediQo identity and required top-bar actions', () => {
  const html = renderShell({ path: '/', content: '<main>hello</main>' })
  assert.match(html, /MEDIQO|mediqo-logo/i)
  assert.match(html, /Riverside Medical Centre/)
  assert.match(html, /Connect your PMS/)
  assert.match(html, /Alerts/)
  assert.match(html, /Help/)
  assert.match(html, /Practice Manager/)
})

test('route titles resolve required feature routes', () => {
  assert.equal(routeTitle('/'), 'Ask a Question')
  assert.equal(routeTitle('/accreditation'), 'Accreditation Assistant')
  assert.equal(routeTitle('/policies'), 'Policy Library')
  assert.equal(routeTitle('/reports'), 'Reports')
  assert.equal(routeTitle('/alerts'), 'Alerts Centre')
  assert.equal(routeTitle('/products/ai-receptionist'), 'AI Receptionist')
})


test('practice selector exposes an interactive practice menu action', () => {
  const html = renderShell({ path: '/', content: '<main>hello</main>' })
  assert.match(html, /data-action="toggle-practice-menu"/)
})


test('shell reflects the selected practice after account setup', () => {
  const html = renderShell({ path: '/', content: '<main>hello</main>', selectedPractice: 'Harbour Family Clinic' })
  assert.match(html, /Harbour Family Clinic/)
  assert.match(html, />HF</)
})
