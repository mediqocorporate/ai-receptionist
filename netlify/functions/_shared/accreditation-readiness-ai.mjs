import { createAccreditationAnswer } from './openai.mjs'

const REVIEW_QUESTION = 'Run a pre-accreditation review of the saved practice state. Use these exact section titles: Priority next actions; Confirmed gaps; Unresolved checks; Evidence follow-ups; Positive readiness observations; Limitations. Keep unknown information unresolved and do not make a pass, compliance or accreditation determination.'

function findSection(sections = [], title = '') {
  const wanted = String(title).toLowerCase()
  return (Array.isArray(sections) ? sections : []).find((section) =>
    String(section?.title || '').trim().toLowerCase() === wanted
  ) || null
}

function sectionValues(answer, title) {
  const section = findSection(answer?.sections, title)
  if (!section) return []
  const values = []
  if (String(section.body || '').trim()) values.push(String(section.body).trim())
  for (const item of Array.isArray(section.items) ? section.items : []) {
    const text = String(item || '').trim()
    if (text) values.push(text)
  }
  return values
}

export async function createAccreditationReadinessReview({
  apiKey,
  model,
  context = {},
  resources = [],
  safetyIdentifier,
  generateAnswer = createAccreditationAnswer,
} = {}) {
  const generated = await generateAnswer({
    apiKey,
    model,
    question: REVIEW_QUESTION,
    context,
    resources,
    safetyIdentifier,
  })
  const answer = generated?.answer || {}
  const sources = Array.isArray(answer.sources) ? answer.sources : []
  return {
    model: generated?.model || model || '',
    responseId: generated?.responseId || '',
    review: {
      executiveSummary: String(answer.intro || '').trim(),
      priorityActions: sectionValues(answer, 'Priority next actions'),
      confirmedGaps: sectionValues(answer, 'Confirmed gaps'),
      unresolvedChecks: sectionValues(answer, 'Unresolved checks'),
      evidenceFollowUps: sectionValues(answer, 'Evidence follow-ups'),
      strengths: sectionValues(answer, 'Positive readiness observations'),
      limitations: sectionValues(answer, 'Limitations'),
      sourceIds: sources.map((source) => String(source?.id || '').trim()).filter(Boolean),
      sources,
    },
  }
}
