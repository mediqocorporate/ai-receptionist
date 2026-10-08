import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldUseLocalQuestionGate, shouldRecordLocalQuestion } from '../src/lib/qna-mode.js'

test('live assistant never trusts the browser local question gate', () => {
  assert.equal(shouldUseLocalQuestionGate({ live: true, user: null, canAsk: false }), false)
  assert.equal(shouldUseLocalQuestionGate({ live: false, user: null, canAsk: false }), true)
})

test('live assistant does not duplicate server-persisted question logs locally', () => {
  assert.equal(shouldRecordLocalQuestion({ live: true }), false)
  assert.equal(shouldRecordLocalQuestion({ live: false }), true)
})
