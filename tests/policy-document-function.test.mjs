import test from 'node:test'
import assert from 'node:assert/strict'
import { createPolicyDocumentHandler } from '../netlify/functions/policy-document.mjs'

function event(body, authorization = 'Bearer token') {
  return { httpMethod: 'POST', headers: { authorization }, body: JSON.stringify(body) }
}

test('policy document API requires authentication', async () => {
  const handler = createPolicyDocumentHandler({
    authenticate: async () => null,
    createServer: () => ({}),
    generateDraft: async () => ({ title: 'x', content: 'x' }),
  })
  const response = await handler(event({ action: 'list' }, ''))
  assert.equal(response.statusCode, 401)
})

test('generate uses authenticated practice context and ignores any client practice id', async () => {
  let generationInput
  const handler = createPolicyDocumentHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => ({
      getPracticeSummary: async (practiceId) => {
        assert.equal(practiceId, 'practice_1')
        return { id: 'practice_1', name: 'Harbour Medical Centre' }
      },
    }),
    generateDraft: async (input) => {
      generationInput = input
      return { title: 'Privacy Procedure', content: 'Comprehensive draft' }
    },
  })
  const response = await handler(event({
    action: 'generate',
    practiceId: 'practice_evil',
    documentType: 'Privacy procedure',
    considerations: 'Include our local escalation process',
  }))
  assert.equal(response.statusCode, 200)
  assert.equal(generationInput.practiceName, 'Harbour Medical Centre')
  assert.equal(generationInput.documentType, 'Privacy procedure')
  assert.match(generationInput.considerations, /local escalation/)
})

test('save persists generated content against the authenticated practice and user', async () => {
  let saved
  const handler = createPolicyDocumentHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => ({
      savePracticeDocument: async (payload) => { saved = payload; return { id: 'doc_1', ...payload } },
    }),
    generateDraft: async () => ({ title: 'x', content: 'x' }),
  })
  const response = await handler(event({
    action: 'save',
    practiceId: 'practice_evil',
    title: 'Reception Procedure',
    documentType: 'Procedure',
    considerations: 'Local process',
    content: 'Draft body',
  }))
  assert.equal(response.statusCode, 200)
  assert.equal(saved.practiceId, 'practice_1')
  assert.equal(saved.userId, 'user_1')
  assert.equal(saved.content, 'Draft body')
})

test('list is practice scoped on the server', async () => {
  let practiceSeen
  const handler = createPolicyDocumentHandler({
    authenticate: async () => ({ userId: 'user_1', practiceId: 'practice_1' }),
    createServer: () => ({
      listPracticeDocuments: async (practiceId) => { practiceSeen = practiceId; return [{ id: 'doc_1', title: 'Saved policy' }] },
    }),
    generateDraft: async () => ({ title: 'x', content: 'x' }),
  })
  const response = await handler(event({ action: 'list', practiceId: 'other' }))
  assert.equal(response.statusCode, 200)
  assert.equal(practiceSeen, 'practice_1')
  assert.match(response.body, /Saved policy/)
})
