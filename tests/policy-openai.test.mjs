import test from 'node:test'
import assert from 'node:assert/strict'
import { createPolicyDraft } from '../netlify/functions/_shared/policy-openai.mjs'

test('policy OpenAI adapter asks for a comprehensive editable draft and rejects empty output', async () => {
  let request
  const fetchImpl = async (_url, options) => {
    request = JSON.parse(options.body)
    return new Response(JSON.stringify({
      id: 'resp_1',
      model: 'gpt-6-luna',
      output_text: JSON.stringify({ title: 'Privacy Incident Response Procedure', content: 'Purpose\nScope\nResponsibilities\nProcedure\nRecords\nReview' }),
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const result = await createPolicyDraft({
    apiKey: 'key',
    practiceName: 'Harbour Medical Centre',
    documentType: 'Privacy incident response procedure',
    considerations: 'Include local escalation roles',
    fetchImpl,
  })
  assert.equal(result.title, 'Privacy Incident Response Procedure')
  assert.match(result.content, /Responsibilities/)
  assert.match(request.instructions, /comprehensive/i)
  assert.match(request.instructions, /draft/i)
  assert.match(request.instructions, /do not claim.*accreditation|not automatically.*accreditation/i)
})
