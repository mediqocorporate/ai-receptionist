import test from 'node:test'
import assert from 'node:assert/strict'
import { createMediQoAnswer, extractResponseText, INTERACTIVE_OPENAI_TIMEOUT_MS } from '../netlify/functions/_shared/openai.mjs'

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
  assert.equal(request.body.max_output_tokens, 5000)
  assert.deepEqual(request.body.reasoning, { effort: 'low' })
  assert.equal(request.body.safety_identifier, 'user_hash')
  assert.equal(request.body.text.format.type, 'json_object')
  assert.match(request.body.input, /json/i)
  assert.equal(result.responseId, 'resp_123')
  assert.equal(result.answer.intro, 'Start here.')
  assert.deepEqual(result.answer.sources, [])
  assert.deepEqual(result.answer.relatedResources, [])
})


test('Terra live Q&A defaults to no reasoning for interactive latency', async () => {
  let request
  const fetchImpl = async (_url, options) => {
    request = JSON.parse(options.body)
    return new Response(JSON.stringify({
      id: 'resp_fast',
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        intro: 'Fast answer.',
        sections: [{ title: 'Next', body: 'Do this.', items: [] }],
        risk: false,
        relatedQuestions: [],
        recommendation: null
      }) }] }]
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  await createMediQoAnswer({
    apiKey: 'sk-test-secret',
    model: 'gpt-5.6-terra',
    question: 'How should I prepare?',
    fetchImpl,
  })

  assert.deepEqual(request.reasoning, { effort: 'none' })
})

test('incomplete OpenAI structured output is reported before JSON parsing', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    id: 'resp_incomplete',
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' },
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"intro":"truncated"' }] }]
  }), { status: 200, headers: { 'content-type': 'application/json' } })

  await assert.rejects(
    () => createMediQoAnswer({
      apiKey: 'sk-test-secret',
      model: 'gpt-5.6-terra',
      question: 'Question',
      fetchImpl,
    }),
    /incomplete.*max_output_tokens/i,
  )
})


test('interactive adapter defaults to GPT-6 Luna with no reasoning', async () => {
  let request
  const fetchImpl = async (_url, options) => {
    request = JSON.parse(options.body)
    return new Response(JSON.stringify({
      id: 'resp_luna_default',
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        intro: 'Luna answer.',
        sections: [{ title: 'Next', body: 'Do this.', items: [] }],
        risk: false,
        relatedQuestions: [],
        recommendation: null
      }) }] }]
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  await createMediQoAnswer({
    apiKey: 'sk-test-secret',
    question: 'How should I prepare?',
    fetchImpl,
  })

  assert.equal(request.model, 'gpt-6-luna')
  assert.deepEqual(request.reasoning, { effort: 'none' })
  assert.equal(request.max_output_tokens, 1200)
})


test('JSON mode normalizes loose risk and recommendation shapes safely', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    id: 'resp_loose_json',
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
      intro: 'Practical answer.',
      sections: [{ title: 'First step', body: 'Review the site.', items: ['Confirm access'] }],
      risk: 'Verify current NSW requirements before opening.',
      relatedQuestions: ['What records should I keep?'],
      recommendation: 'Assign an owner to every action.'
    }) }] }]
  }), { status: 200, headers: { 'content-type': 'application/json' } })

  const result = await createMediQoAnswer({
    apiKey: 'sk-test-secret',
    model: 'gpt-6-luna',
    question: 'Give me a checklist',
    fetchImpl,
  })

  assert.equal(result.answer.risk, true)
  assert.equal(result.answer.recommendation, null)
  assert.deepEqual(result.answer.sections[0].items, ['Confirm access'])
})


test('interactive OpenAI timeout leaves headroom under the local Netlify 30-second limit', () => {
  assert.equal(INTERACTIVE_OPENAI_TIMEOUT_MS, 27000)
})
