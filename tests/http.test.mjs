import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCookies, buildCookie, sha256Hex } from '../netlify/functions/_shared/http.mjs'

test('cookie helpers parse values and build an HttpOnly SameSite cookie', async () => {
  assert.deepEqual(parseCookies('a=1; mediqo_anon=token%20value; empty='), {
    a: '1', mediqo_anon: 'token value', empty: '',
  })
  const cookie = buildCookie('mediqo_anon', 'abc', { secure: true, maxAge: 60 })
  assert.match(cookie, /^mediqo_anon=abc;/)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /Max-Age=60/)
  assert.match(cookie, /Secure/)
})

test('sha256Hex is deterministic and never returns the raw token', async () => {
  const first = await sha256Hex('secret-token')
  const second = await sha256Hex('secret-token')
  assert.equal(first, second)
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.notEqual(first, 'secret-token')
})
