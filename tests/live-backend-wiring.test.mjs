import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
const assistant = fs.readFileSync(new URL('../src/services/assistant-service.js', import.meta.url), 'utf8')
const lead = fs.readFileSync(new URL('../src/services/lead-service.js', import.meta.url), 'utf8')

test('live Q&A lets the server own anonymous quota and preserves conversation identity', () => {
  assert.match(app, /assistantService\.isLive\(\)/)
  assert.match(app, /shouldUseLocalQuestionGate/)
  assert.match(app, /result\.signupRequired/)
  assert.match(app, /conversationId:\s*ui\.conversationId/)
  assert.match(app, /result\.conversationId/)
  assert.match(assistant, /credentials:\s*'include'/)
  assert.match(assistant, /code === 'signup_required'/)
})

test('authenticated state claims anonymous history, syncs CRM best-effort and reloads persisted questions', () => {
  assert.match(app, /syncAuthenticatedAccountState/)
  assert.match(app, /leadService\.syncPlatformAccount\(\)/)
  assert.match(app, /questionService\.loadRecent\(12\)/)
  assert.match(lead, /accountSyncApiUrl/)
  assert.match(lead, /credentials:\s*'include'/)
})
