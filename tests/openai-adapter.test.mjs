import test from 'node:test'
import assert from 'node:assert/strict'
import { createMediQoAnswer, extractResponseText } from '../netlify/functions/_shared/openai.mjs'

test('extractResponseText reads Responses API output items', () => {
  const payload = { output: [{ type: 'message', content: [{ type: 'output_text', text: '{"intro":"Hello"}' }] }] }
  assert.equal(extractResponseText(payload), '{"intro":"Hello"}')
})

test('createMediQoAnswer keeps the OpenAI key server-side and requests structured output', async () => {
  let request
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) }
    return new Response(JSON.stringify({
      id: 'resp_123',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        intro: 'Start here.',
        sections: [{ title: 'Next step', body: 'Review the current requirement.', items: [] }],
        risk: false,
        relatedQuestions: ['What evidence should I keep?'],
        recommendation: null
      }) }] }]
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const result = await createMediQoAnswer({
    apiKey: 'sk-test-secret',
    model: 'gpt-6.1-sol',
    question: 'What should our practice do?',
    safetyIdentifier: 'user_hash',
    fetchImpl,
  })

  assert.equal(request.url, 'https://api.openai.com/v1/responses')
  assert.equal(request.options.headers.Authorization, 'Bearer sk-test-secret')
  assert.equal(request.body.model, 'gpt-6.1-sol')
  assert.equal(request.body.store, false)
  assert.equal(request.body.max_output_tokens, 1600)
  assert.equal(request.body.safety_identifier, 'user_hash')
  assert.equal(request.body.text.format.type, 'json_schema')
  assert.equal(request.body.text.format.strict, true)
  assert.equal(result.responseId, 'resp_123')
  assert.equal(result.answer.intro, 'Start here.')
  assert.deepEqual(result.answer.sources, [])
  assert.deepEqual(result.answer.relatedResources, [])
})
