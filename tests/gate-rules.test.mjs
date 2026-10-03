import test from 'node:test'
import assert from 'node:assert/strict'
import { canAskWithoutSignup, recordAnsweredQuestion, unlockWithUser } from '../src/lib/prototype-rules.js'

test('anonymous visitor can receive exactly two answered questions', () => {
  const state = { freeQuestionCount: 0, user: null }
  assert.equal(canAskWithoutSignup(state), true)
  recordAnsweredQuestion(state)
  assert.equal(canAskWithoutSignup(state), true)
  recordAnsweredQuestion(state)
  assert.equal(canAskWithoutSignup(state), false)
})

test('signed-in demo user is not gated by anonymous question count', () => {
  const state = { freeQuestionCount: 2, user: null }
  unlockWithUser(state, { id: 'demo_1', email: 'pm@example.com' })
  assert.equal(canAskWithoutSignup(state), true)
  assert.equal(state.user.email, 'pm@example.com')
})
