import test from 'node:test'
import assert from 'node:assert/strict'
import { signupSuccessMessage } from '../src/lib/ui-copy.js'

test('signup success copy distinguishes account gate from product trial', () => {
  assert.equal(signupSuccessMessage(false), 'Account created')
  assert.equal(signupSuccessMessage(true), 'Free trial started')
})
