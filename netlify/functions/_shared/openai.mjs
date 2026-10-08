const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    intro: { type: 'string', minLength: 1 },
    sections: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1 },
          body: { type: 'string' },
          items: { type: 'array', items: { type: 'string' }, maxItems: 8 },
        },
        required: ['title', 'body', 'items'],
        additionalProperties: false,
      },
    },
    risk: { type: 'boolean' },
    relatedQuestions: {
      type: 'array',
      minItems: 0,
      maxItems: 5,
      items: { type: 'string' },
    },
    recommendation: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
            path: { type: 'string' },
            linkLabel: { type: 'string' },
          },
          required: ['title', 'body', 'path', 'linkLabel'],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ['intro', 'sections', 'risk', 'relatedQuestions', 'recommendation'],
  additionalProperties: false,
}

const INSTRUCTIONS = `You are MediQo, an AI Practice Manager Assistant for Australian general practice.
Give practical, cautious operational guidance. Do not claim formal accreditation compliance, legal certainty, or clinical certainty.
Do not invent citations, URLs, legislation, Medicare item numbers, or regulator requirements. If current authoritative evidence is required and none is provided, say the user should verify the current official source.
Avoid unnecessary patient-identifying information. If the user includes patient details, do not repeat identifiers unless required for the answer.
Answer the question first. Only recommend a MediQo product when it directly solves the user's stated problem, and do not recommend named competitors.
Keep the answer useful for a practice manager and structure it into concise sections.`

export function extractResponseText(payload = {}) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  for (const item of payload.output || []) {
    if (item?.type !== 'message') continue
    for (const part of item.content || []) {
      if ((part?.type === 'output_text' || part?.type === 'text') && typeof part.text === 'string') return part.text
    }
  }
  return ''
}

function normalizeAnswer(value) {
  if (!value || typeof value !== 'object') throw new Error('OpenAI returned an invalid answer payload.')
  if (!String(value.intro || '').trim()) throw new Error('OpenAI returned an answer without an introduction.')
  if (!Array.isArray(value.sections) || value.sections.length === 0) throw new Error('OpenAI returned an answer without sections.')
  return {
    id: `ai_${crypto.randomUUID()}`,
    intro: String(value.intro).trim(),
    sections: value.sections.map((section) => ({
      title: String(section.title || '').trim(),
      body: String(section.body || '').trim(),
      items: Array.isArray(section.items) ? section.items.map((item) => String(item)) : [],
    })),
    risk: Boolean(value.risk),
    sources: [],
    relatedQuestions: Array.isArray(value.relatedQuestions) ? value.relatedQuestions.map((item) => String(item)) : [],
    relatedResources: [],
    recommendation: value.recommendation || null,
  }
}

function defaultReasoningEffort(model) {
  return String(model || '').trim() === 'gpt-6.1-sol' ? 'low' : 'none'
}

function outputTokenBudget(reasoningEffort) {
  return reasoningEffort === 'none' ? 1600 : 5000
}

function firstMessageContent(payload = {}) {
  for (const item of payload.output || []) {
    if (item?.type !== 'message') continue
    for (const part of item.content || []) {
      if (part) return part
    }
  }
  return null
}

export async function createMediQoAnswer({
  apiKey,
  model = 'gpt-6-luna',
  question,
  safetyIdentifier,
  reasoningEffort,
  timeoutMs = 22000,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')
  if (!String(question || '').trim()) throw new Error('Question is required.')

  const resolvedReasoningEffort = String(reasoningEffort || defaultReasoningEffort(model)).trim()
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
        instructions: INSTRUCTIONS,
        input: String(question).trim(),
        store: false,
        max_output_tokens: outputTokenBudget(resolvedReasoningEffort),
        safety_identifier: safetyIdentifier || undefined,
        reasoning: { effort: resolvedReasoningEffort },
      text: {
        format: {
          type: 'json_schema',
          name: 'mediqo_practice_manager_answer',
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
        },
      }),
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error('OpenAI request timed out before MediQo received an answer.')
    }
    throw error
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI request failed with status ${response.status}.`
    throw new Error(message)
  }

  if (payload?.status === 'incomplete') {
    const reason = payload?.incomplete_details?.reason || 'unknown_reason'
    throw new Error(`OpenAI response incomplete: ${reason}.`)
  }

  const firstContent = firstMessageContent(payload)
  if (firstContent?.type === 'refusal') {
    throw new Error(firstContent.refusal || 'OpenAI refused this request.')
  }

  const outputText = extractResponseText(payload)
  if (!outputText) throw new Error('OpenAI returned no answer text.')

  let parsed
  try {
    parsed = JSON.parse(outputText)
  } catch {
    throw new Error('OpenAI returned invalid structured output.')
  }

  return {
    responseId: payload.id || '',
    model: payload.model || model,
    answer: normalizeAnswer(parsed),
  }
}
