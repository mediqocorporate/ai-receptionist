import test from 'node:test'
import assert from 'node:assert/strict'
import { renderSignupDialog, renderLoginDialog } from '../src/components/dialogs.js'
import { renderShell } from '../src/components/shell.js'

test('signup practice name is suggested with placeholder text rather than prefilled data', () => {
  const html = renderSignupDialog()
  assert.match(html, /name="clinicName" value="" placeholder="e\.g\. Riverside Medical Centre"/)
})

test('anonymous shell provides sign in and signed-in menu provides sign out', () => {
  assert.match(renderShell({ user: null }), /data-action="sign-in"/)
  const signedIn = renderShell({
    user: { firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager' },
    userMenuOpen: true,
  })
  assert.match(signedIn, /data-action="sign-out"/)
})

test('login dialog collects email and password', () => {
  const html = renderLoginDialog()
  assert.match(html, /data-login-form/)
  assert.match(html, /name="email"/)
  assert.match(html, /name="password"/)
  assert.match(html, />Sign in</)
})
