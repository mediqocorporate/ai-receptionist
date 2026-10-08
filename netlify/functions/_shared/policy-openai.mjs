export const POLICY_DOCUMENT_TIMEOUT_MS = 32000

const POLICY_INSTRUCTIONS = `You are MediQo's document assistant for Australian general practice.
Create a comprehensive, practical draft document for a Practice Manager to review and edit.
Return JSON only with exactly these keys: title, content.

The content must be plain text with clear section headings and enough detail to be genuinely useful in a working medical practice. Include, where relevant:
Purpose
Scope
Definitions or key terms
Responsibilities
Detailed procedure/workflow
Escalation points
Records/evidence to retain
Training or communication expectations
Monitoring/audit steps
Incident or exception handling
Review/version-control guidance
Practice-specific considerations supplied by the user

Do not invent legislation, regulator requirements, accreditation requirements, URLs, dates or mandatory obligations.
Where the requested document would normally depend on current law, regulation, RACGP Standards, Medicare rules or another authoritative source and that source has not been supplied, write the operational draft conservatively and clearly mark the point that needs current-source verification.
Do not claim the draft satisfies accreditation, is compliant, is certified, or will pass an assessment. A generated document is a draft until the practice reviews, approves and implements it.
Do not include patient-identifying information.
Avoid filler and generic placeholder prose. Make the document comprehensive but readable.`

function extractOutputText(payload = {}) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  for (const item of payload.output || []) {
    if (item?.type !== 'message') continue
    for (const part of item.content || []) {
      if ((part?.type === 'output_text' || part?.type === 'text') && typeof part.text === 'string') return part.text
    }
  }
  return ''
}

export async function createPolicyDraft({
  apiKey,
  model = 'gpt-6-luna',
  practiceName,
  documentType,
  considerations = '',
  templateContext = '',
  timeoutMs = POLICY_DOCUMENT_TIMEOUT_MS,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')
  const requestedType = String(documentType || '').trim()
  if (!requestedType) throw new Error('Document type is required.')

  const signal = timeoutMs > 0 && typeof AbortSignal?.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined

  let response
  try {
    response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: POLICY_INSTRUCTIONS,
        input: [
          `Practice: ${String(practiceName || 'Australian general practice').trim()}`,
          `Document requested: ${requestedType}`,
          considerations ? `What to consider: ${String(considerations).trim()}` : '',
          templateContext ? `Existing template/context to incorporate: ${String(templateContext).trim()}` : '',
          'Return a complete editable draft.',
        ].filter(Boolean).join('\n\n'),
        store: false,
        max_output_tokens: 5000,
        reasoning: { effort: 'none' },
        text: { format: { type: 'json_object' } },
      }),
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('OpenAI document generation timed out.')
    throw error
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed with status ${response.status}.`)
  if (payload?.status === 'incomplete') throw new Error('OpenAI document generation was incomplete.')

  const output = extractOutputText(payload)
  if (!output) throw new Error('OpenAI returned no document draft.')

  let parsed
  try { parsed = JSON.parse(output) } catch { throw new Error('OpenAI returned invalid document JSON.') }

  const title = String(parsed?.title || requestedType).trim()
  const content = String(parsed?.content || '').trim()
  if (!title || !content) throw new Error('OpenAI returned an empty document draft.')
  return { title, content, model: payload.model || model, responseId: payload.id || '' }
}
