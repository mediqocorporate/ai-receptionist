import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssistantService } from '../src/services/assistant-service.js'

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

test('assistant uses deterministic demo matcher when live API is not configured', async () => {
  const service = createAssistantService({ config: { assistantApiUrl: '' }, matchQuestion: () => ({ id: 'demo' }) })
  assert.equal(service.isLive(), false)
  assert.deepEqual(await service.ask('Anything', { fast: true }), { answer: { id: 'demo' }, question: 'Anything' })
})

test('live assistant sends Supabase bearer session and conversation id to the server endpoint', async () => {
  let request
  const service = createAssistantService({
    config: { assistantApiUrl: '/api/ask' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (url, init) => { request = { url, init }; return response(200, { answer: { id: 'ai1' }, conversationId: 'c1', remainingFreeAnswers: null }) },
  })
  const result = await service.ask('Question', { conversationId: 'c0' })
  assert.equal(service.isLive(), true)
  assert.equal(request.url, '/api/ask')
  assert.equal(request.init.headers.Authorization, 'Bearer jwt')
  assert.equal(request.init.credentials, 'include')
  assert.deepEqual(JSON.parse(request.init.body), { question: 'Question', conversationId: 'c0' })
  assert.equal(result.conversationId, 'c1')
})

test('live assistant turns server quota response into signupRequired without throwing', async () => {
  const service = createAssistantService({
    config: { assistantApiUrl: '/api/ask' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
    fetchImpl: async () => response(403, { code: 'signup_required', message: 'Create account', remainingFreeAnswers: 0 }),
  })
  assert.deepEqual(await service.ask('Third question'), { signupRequired: true, message: 'Create account', remainingFreeAnswers: 0 })
})


test('live assistant sends accreditation mode and cycle without exposing practice identity', async () => {
  let sent
  const service = createAssistantService({
    config: { assistantApiUrl: '/api/ask' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body)
      return response(200, { answer: { id: 'aa1' }, conversationId: 'c1' })
    },
  })
  await service.ask('What should we prioritise?', {
    conversationId: 'c0',
    mode: 'accreditation',
    cycleId: 'cycle_1',
    practiceId: 'must-not-be-sent',
  })
  assert.deepEqual(sent, {
    question: 'What should we prioritise?',
    conversationId: 'c0',
    mode: 'accreditation',
    cycleId: 'cycle_1',
  })
})
