import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')

test('app wires production auth session, login and logout', () => {
  assert.match(source, /renderLoginDialog/)
  assert.match(source, /let appUser/)
  assert.match(source, /authService\.getCurrentUser\(\)/)
  assert.match(source, /authService\.signIn/)
  assert.match(source, /authService\.signOut\(\)/)
  assert.match(source, /user:\s*appUser/)
  assert.doesNotMatch(source, /clinicName:\s*prototype\.user\?\.clinicName\s*\|\|\s*'Riverside Medical Centre'/)
})
