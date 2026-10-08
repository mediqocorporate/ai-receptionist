import test from 'node:test'
import assert from 'node:assert/strict'
import { processAsk } from '../netlify/functions/_shared/ask-core.mjs'

const generated = {
  responseId: 'resp_1',
  model: 'gpt-5.6',
  answer: {
    id: 'ai_1', intro: 'Answer', sections: [{ title: 'Next', body: 'Do this', items: [] }], risk: false,
    sources: [], relatedQuestions: [], relatedResources: [], recommendation: null,
  },
}

test('anonymous third question is blocked before OpenAI is called', async () => {
  let generatedCalled = false
  const result = await processAsk({ question: 'Third?', actor: null, anonymousTokenHash: 'hash' }, {
    reserveAnonymous: async () => ({ sessionId: 'anon_1', allowed: false, remaining: 0 }),
    generateAnswer: async () => { generatedCalled = true; return generated },
    persistAnswer: async () => ({ conversationId: 'c1', questionLogId: 'q1' }),
    completeAnonymous: async () => ({ remaining: 0 }),
    releaseAnonymous: async () => {},
  })
  assert.equal(result.statusCode, 403)
  assert.equal(result.body.code, 'signup_required')
  assert.equal(generatedCalled, false)
})

test('anonymous quota is consumed only after answer persistence succeeds', async () => {
  const order = []
  const result = await processAsk({ question: 'First?', actor: null, anonymousTokenHash: 'hash' }, {
    reserveAnonymous: async () => { order.push('reserve'); return { sessionId: 'anon_1', allowed: true, remaining: 1 } },
    generateAnswer: async () => { order.push('generate'); return generated },
    persistAnswer: async (payload) => { order.push('persist'); assert.match(payload.answerText, /Answer/); assert.match(payload.answerText, /Do this/); return { conversationId: 'c1', questionLogId: 'q1' } },
    completeAnonymous: async () => { order.push('complete'); return { remaining: 1 } },
    releaseAnonymous: async () => { order.push('release') },
  })
  assert.deepEqual(order, ['reserve','generate','persist','complete'])
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.remainingFreeAnswers, 1)
  assert.equal(result.body.conversationId, 'c1')
})

test('failed anonymous generation releases the reservation', async () => {
  const order = []
  await assert.rejects(() => processAsk({ question: 'Fail?', actor: null, anonymousTokenHash: 'hash' }, {
    reserveAnonymous: async () => { order.push('reserve'); return { sessionId: 'anon_1', allowed: true, remaining: 1 } },
    generateAnswer: async () => { order.push('generate'); throw new Error('boom') },
    persistAnswer: async () => { order.push('persist'); return {} },
    completeAnonymous: async () => { order.push('complete'); return {} },
    releaseAnonymous: async () => { order.push('release') },
  }), /boom/)
  assert.deepEqual(order, ['reserve','generate','release'])
})

test('authenticated users do not reserve anonymous quota', async () => {
  const actor = { userId: 'user_1', practiceId: 'practice_1', safetyIdentifier: 'safe_user' }
  let reserved = false
  const result = await processAsk({ question: 'Hello', actor, conversationId: null }, {
    reserveAnonymous: async () => { reserved = true; return {} },
    generateAnswer: async () => generated,
    persistAnswer: async ({ userId, practiceId }) => {
      assert.equal(userId, 'user_1')
      assert.equal(practiceId, 'practice_1')
      return { conversationId: 'c2', questionLogId: 'q2' }
    },
    completeAnonymous: async () => ({}),
    releaseAnonymous: async () => {},
  })
  assert.equal(reserved, false)
  assert.equal(result.body.remainingFreeAnswers, null)
})
