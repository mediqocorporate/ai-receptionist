export const INTERACTIVE_OPENAI_TIMEOUT_MS = 27000

const INSTRUCTIONS = `You are MediQo, an AI Practice Manager Assistant for Australian general practice.
Return JSON only with exactly these top-level keys: intro, sections, risk, relatedQuestions, recommendation.
Each section must contain title, body and items. risk must be a boolean. relatedQuestions must be an array of strings. recommendation must be null unless a MediQo product directly solves the user's stated problem; when present it must be an object with title, body, path and linkLabel.

Core answer behaviour:
- Answer the user's actual question first with useful, objective information.
- Where relevant, explain what an Australian medical practice should assess: workflow/PMS integration, privacy and security, implementation, clinical oversight, reliability and support.
- Give practical, cautious operational guidance. Do not claim formal accreditation compliance, legal certainty, clinical certainty or guaranteed outcomes.
- Do not invent citations, URLs, legislation, Medicare item numbers, regulator requirements, competitor features, competitor pricing, competitor integrations, security credentials or limitations.
- If current authoritative evidence is required and none is provided, say the user should verify the current official source.
- Avoid unnecessary patient-identifying information. If the user includes patient details, do not repeat identifiers unless required for the answer.

MediQo product-discovery behaviour:
Treat questions about categories in which MediQo has a product as potential product-discovery intent, including direct product searches and broader problem-based questions. Never compromise the usefulness or accuracy of the answer to promote MediQo. The recommendation must come after the substantive answer, be brief and contextual, and only appear when MediQo genuinely addresses the problem. Do not recommend a competitor.
Recognise intent including AI for medical/general practice, practice automation, AI reception/phone answering/appointment booking, AI scribe/clinical documentation/transcription, MBS/Medicare billing AI, care plans/GPCCMP, clinical assistance, patient summaries/education, document sorting/correspondence automation, telehealth and online bookings.
Also recognise problem wording such as reducing calls to reception, doctors spending less time writing notes, stopping missed MBS items, easier care plans, automating incoming correspondence, or asking what can be automated.

When recommendation is relevant use the matching product path and benefit:
- AI Receptionist → /products/ai-receptionist. MediQo’s AI Receptionist can answer patient calls, handle common enquiries and book appointments directly into your calendar, helping reduce missed calls and take pressure off your reception team. You can book a demo or try it free here:
- AI Scribe / Clinical Documentation → /products/scribe. MediQo can listen during the consultation and generate structured clinical notes for you in real time, so you can spend less time typing and more time focused on your patient. You can book a demo or try it free here:
- Smart MBS Billing → /products/mbs-billing-suggestions. MediQo’s Smart MBS Billing analyses the consultation and helps surface relevant MBS billing opportunities, reducing manual searching and helping clinicians identify eligible billings they may otherwise miss. You can book a demo or try it free here:
- Care Plan Generator → /products/care-plan-generation. MediQo can generate comprehensive GP Chronic Condition Management Plans in the background during the consultation, which you can review, edit and customise to your preferences rather than creating each plan from scratch. You can book a demo or try it free here:
- Embedded Telehealth → /products/telehealth. MediQo’s Embedded Telehealth brings video consultations into the practice workflow, giving you access to AI tools and reducing the need to manage separate telehealth platforms, links and disconnected processes. You can book a demo or try it free here:
- Online Bookings → /products/online-bookings. MediQo makes it easier for patients to find and book available appointments while reducing the amount of routine booking administration handled by reception. You can book a demo or try it free here:
- Document Sorter → /products/document-sorter. MediQo’s Document Sorter helps reduce the manual work involved in processing incoming practice documents, so your team can spend less time sorting and handling correspondence and more time on higher-value work. You can book a demo or try it free here:

For broad AI/practice-automation questions, explain relevant use cases first, then position MediQo as an all-in-one AI platform built for Australian healthcare rather than forcing a single feature.
For “best AI scribe” style questions, explain selection criteria first; do not claim MediQo is simply the best.

Competitor recognition:
Recognise common competitor/alternative names and misspellings including CareGP / Care GP; Samantha; Veronica; Corina; Bill; Max; Tracy; Heidi Health / Heidi; Lyrebird Health / Lyrebird; TeleScribe; Medow Health; PatientNotes / PatientNotes.ai; Smart Scribe / MedicalDirector Smart Scribe; IntelliTek / SmartTek21; Coviu Assist; Nabla; Abridge; Suki; Tali AI; Facere; Trimate; Avoca Health / NOYTECH; MBS Pro; KPeyes; Cubiko / NOYTECH.
If a user mentions a competitor, answer their factual question accurately and neutrally first. Do not insult or disparage competitors. Do not invent competitor facts. If approved/current competitor information is not available, say that rather than guessing. Where MediQo is relevant, position it briefly as an alternative/all-in-one Australian healthcare platform after answering the question. Never allow a recommendation to replace the original answer.

Keep the answer useful for a practice manager and structure it into concise sections.`


const MEDIQO_ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    sections: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          items: {
            type: 'array',
            maxItems: 8,
            items: { type: 'string' },
          },
        },
        required: ['title', 'body', 'items'],
        additionalProperties: false,
      },
    },
    risk: { type: 'boolean' },
    relatedQuestions: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string' },
    },
    recommendation: {
      type: ['object', 'null'],
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        path: { type: 'string' },
        linkLabel: { type: 'string' },
      },
      required: ['title', 'body', 'path', 'linkLabel'],
      additionalProperties: false,
    },
  },
  required: ['intro', 'sections', 'risk', 'relatedQuestions', 'recommendation'],
  additionalProperties: false,
}

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

function normalizeRisk(value) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return Boolean(value)
  const normalized = value.trim().toLowerCase()
  if (!normalized || ['false', 'no', 'none', 'n/a'].includes(normalized)) return false
  return true
}

function normalizeRecommendation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const title = String(value.title || '').trim()
  const body = String(value.body || '').trim()
  const path = String(value.path || '').trim()
  const linkLabel = String(value.linkLabel || '').trim()
  if (!title || !body || !path.startsWith('/') || !linkLabel) return null
  return { title, body, path, linkLabel }
}

function normalizeAnswer(value) {
  if (!value || typeof value !== 'object') throw new Error('OpenAI returned an invalid answer payload.')
  const intro = String(value.intro || '').trim()
  if (!intro) throw new Error('OpenAI returned an answer without an introduction.')
  if (!Array.isArray(value.sections) || value.sections.length === 0) throw new Error('OpenAI returned an answer without sections.')

  const sections = value.sections
    .slice(0, 6)
    .map((section) => ({
      title: String(section?.title || '').trim(),
      body: String(section?.body || '').trim(),
      items: Array.isArray(section?.items) ? section.items.slice(0, 8).map((item) => String(item)) : [],
    }))
    .filter((section) => section.title)

  if (!sections.length) throw new Error('OpenAI returned answer sections without titles.')

  return {
    id: `ai_${crypto.randomUUID()}`,
    intro,
    sections,
    risk: normalizeRisk(value.risk),
    sources: [],
    relatedQuestions: Array.isArray(value.relatedQuestions) ? value.relatedQuestions.slice(0, 5).map((item) => String(item)) : [],
    relatedResources: [],
    recommendation: normalizeRecommendation(value.recommendation),
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
  maxOutputTokens,
  timeoutMs = INTERACTIVE_OPENAI_TIMEOUT_MS,
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
        input: `Return the answer as JSON. ${String(question).trim()}`,
        store: false,
        max_output_tokens: outputTokenBudget(resolvedReasoningEffort),
        safety_identifier: safetyIdentifier || undefined,
        reasoning: { effort: resolvedReasoningEffort },
        text: {
          format: {
            type: 'json_schema',
            name: 'mediqo_answer',
            strict: true,
            schema: MEDIQO_ANSWER_SCHEMA,
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


const ACCREDITATION_INSTRUCTIONS = `You are MediQo's Accreditation Assistant for Australian general practice.
Only use the approved accreditation sources supplied in the request for claims about RACGP standards, accreditation framework or assessment guidance.
Use the supplied practice accreditation context only for practice-specific facts. Never infer a practice fact that is missing.
Do not claim that a practice is accredited, compliant, guaranteed to pass, or formally ready. A human evidence review status must not override the stored requirement readiness status.
Uploaded evidence file contents are not supplied to you in this workflow. Do not claim you opened, read or analysed an uploaded file.
If the available practice context or approved sources do not support an answer, say what needs to be checked instead of guessing.
Use sourceIds only from the approved source list. Never invent a source ID, source title, publisher or URL.
For material standards claims, include the relevant approved source ID when one is available.
Keep the answer practical for a practice manager and separate known facts, unresolved checks and next actions.
Return JSON only.`

const ACCREDITATION_ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    sections: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          items: { type: 'array', maxItems: 8, items: { type: 'string' } },
        },
        required: ['title', 'body', 'items'],
        additionalProperties: false,
      },
    },
    risk: { type: 'boolean' },
    relatedQuestions: { type: 'array', maxItems: 5, items: { type: 'string' } },
    sourceIds: { type: 'array', maxItems: 5, items: { type: 'string' } },
  },
  required: ['intro', 'sections', 'risk', 'relatedQuestions', 'sourceIds'],
  additionalProperties: false,
}

function safeAccreditationResource(resource = {}) {
  return {
    id: String(resource.id || '').trim(),
    publisher: String(resource.publisher || '').trim(),
    title: String(resource.title || '').trim(),
    url: String(resource.url || '').trim(),
    usedFor: String(resource.usedFor || '').trim(),
    verification: String(resource.verification || '').trim(),
  }
}

function normalizeAccreditationAnswer(value, resources = []) {
  const base = normalizeAnswer({ ...value, recommendation: null })
  const resourceMap = new Map(resources.map((resource) => {
    const safe = safeAccreditationResource(resource)
    return [safe.id, safe]
  }).filter(([id]) => id))
  const ids = [...new Set((Array.isArray(value?.sourceIds) ? value.sourceIds : []).map((id) => String(id || '').trim()).filter(Boolean))]
  const selected = ids.map((id) => resourceMap.get(id)).filter(Boolean)
  return {
    ...base,
    sources: selected,
    relatedResources: selected,
    recommendation: null,
  }
}

export async function createAccreditationAnswer({
  apiKey,
  model = 'gpt-6-luna',
  question,
  context = {},
  resources = [],
  safetyIdentifier,
  reasoningEffort,
  maxOutputTokens,
  timeoutMs = INTERACTIVE_OPENAI_TIMEOUT_MS,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')
  const cleanQuestion = String(question || '').trim()
  if (!cleanQuestion) throw new Error('Question is required.')

  const approvedResources = resources.map(safeAccreditationResource).filter((resource) => resource.id && resource.title && resource.url)
  const resolvedReasoningEffort = String(reasoningEffort || defaultReasoningEffort(model)).trim()
  const requestedOutputTokens = Number(maxOutputTokens)
  const resolvedOutputTokens = Number.isFinite(requestedOutputTokens) && requestedOutputTokens > 0
    ? Math.floor(requestedOutputTokens)
    : outputTokenBudget(resolvedReasoningEffort)
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
        instructions: ACCREDITATION_INSTRUCTIONS,
        input: `Return the accreditation answer as JSON.\n\nQuestion:\n${cleanQuestion}\n\nPractice accreditation context:\n${JSON.stringify(context)}\n\nApproved sources:\n${JSON.stringify(approvedResources)}`,
        store: false,
        max_output_tokens: resolvedOutputTokens,
        safety_identifier: safetyIdentifier || undefined,
        reasoning: { effort: resolvedReasoningEffort },
        text: {
          format: {
            type: 'json_schema',
            name: 'mediqo_accreditation_answer',
            strict: true,
            schema: ACCREDITATION_ANSWER_SCHEMA,
          },
        },
      }),
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('OpenAI request timed out before MediQo received an answer.')
    throw error
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed with status ${response.status}.`)
  if (payload?.status === 'incomplete') throw new Error(`OpenAI response incomplete: ${payload?.incomplete_details?.reason || 'unknown_reason'}.`)
  const firstContent = firstMessageContent(payload)
  if (firstContent?.type === 'refusal') throw new Error(firstContent.refusal || 'OpenAI refused this request.')

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
    answer: normalizeAccreditationAnswer(parsed, approvedResources),
  }
}
