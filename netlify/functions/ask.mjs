import { processAsk } from './_shared/ask-core.mjs'
import { createAccreditationAnswer, createMediQoAnswer } from './_shared/openai.mjs'
import { authenticateUser, createSupabaseServer } from './_shared/supabase-server.mjs'
import {
  ANONYMOUS_COOKIE_NAME,
  buildCookie,
  isSecureRequest,
  jsonResponse,
  parseCookies,
  parseJsonBody,
  randomToken,
  sha256Hex,
} from './_shared/http.mjs'

function header(event, name) {
  const headers = event?.headers || {}
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || ''
}

function mentionedIndicators(question = '') {
  return [...new Set(String(question || '').toUpperCase().match(/\b[A-Z]{1,3}\d+(?:\.\d+)+[A-Z]?\b/g) || [])]
}

function compactAccreditationContext({ cycleId, question, overview = {}, missing = {}, actions = {}, evidence = [] } = {}) {
  const indicators = new Set(mentionedIndicators(question))
  const allRequirements = Array.isArray(overview.requirements) ? overview.requirements : []
  const requirements = allRequirements
    .filter((item) => indicators.has(String(item?.indicator || '').toUpperCase()) || String(item?.readinessStatus || '') !== 'NOT_CHECKED')
    .slice(0, 40)
    .map((item) => ({
      id: item.id,
      indicator: item.indicator,
      criterionDescription: item.criterionDescription,
      plainEnglishRequirement: item.plainEnglishRequirement,
      applicabilityStatus: item.applicabilityStatus,
      applicabilityReason: item.applicabilityReason,
      classification: item.classification,
      classificationLabel: item.classificationLabel,
      contentValidationStatus: item.contentValidationStatus,
      readinessStatus: item.readinessStatus,
      verificationStatus: item.verificationStatus,
      statusReason: item.statusReason,
      knownFacts: Array.isArray(item.knownFacts) ? item.knownFacts.slice(0, 8) : [],
      unknownFacts: Array.isArray(item.unknownFacts) ? item.unknownFacts.slice(0, 8) : [],
      potentialGaps: Array.isArray(item.potentialGaps) ? item.potentialGaps.slice(0, 8) : [],
      confirmedGaps: Array.isArray(item.confirmedGaps) ? item.confirmedGaps.slice(0, 8) : [],
      recommendedActions: Array.isArray(item.recommendedActions) ? item.recommendedActions.slice(0, 8) : [],
      evidenceCount: Number(item.evidenceCount || 0),
    }))

  const missingItems = Array.isArray(missing?.items) ? missing.items.slice(0, 30).map((item) => ({
    requirementId: item.requirementId,
    indicator: item.indicator,
    title: item.title,
    reason: item.reason,
    priority: item.priority,
    evidenceType: item.evidenceType,
  })) : []

  const actionItems = (Array.isArray(actions?.items) ? actions.items : [])
    .filter((item) => String(item?.status || '') !== 'DONE')
    .slice(0, 30)
    .map((item) => ({
      id: item.id,
      requirementId: item.requirementId,
      requirementIndicator: item.requirementIndicator,
      title: item.title,
      description: item.description,
      priority: item.priority,
      ownerName: item.ownerName,
      dueDate: item.dueDate,
      status: item.status,
      sourceReason: item.sourceReason,
    }))

  const evidenceItems = (Array.isArray(evidence) ? evidence : []).slice(0, 30).map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    status: item.status,
    processingStatus: item.processingStatus,
    documentDate: item.documentDate,
    reviewDate: item.reviewDate,
    version: item.version,
    mappings: (Array.isArray(item.mappings) ? item.mappings : []).map((mapping) => ({ requirementId: mapping.requirementId })),
    assessments: (Array.isArray(item.assessments) ? item.assessments : []).map((assessment) => ({
      requirementId: assessment.requirementId,
      reviewStatus: assessment.reviewStatus,
      reason: assessment.reason,
      recommendedAction: assessment.recommendedAction,
      humanReviewRequired: assessment.humanReviewRequired,
    })),
  }))

  return {
    cycleId,
    standardVersion: overview.standardVersion || null,
    coverage: overview.coverage || null,
    assessmentCoverage: overview.assessmentCoverage || null,
    readiness: overview.readiness || null,
    statusCounts: overview.statusCounts || null,
    requirements,
    missing: missingItems,
    actions: actionItems,
    evidence: evidenceItems,
  }
}

export function createAskHandler({
  env = process.env,
  authenticate = ({ authorization }) => authenticateUser({ authorization, env }),
  createServer = () => createSupabaseServer({ env }),
  generateAnswer = ({ question, safetyIdentifier }) => createMediQoAnswer({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || 'gpt-6-luna',
    question,
    safetyIdentifier,
  }),
  generateAccreditationAnswer = ({ question, safetyIdentifier, context, resources }) => createAccreditationAnswer({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || 'gpt-6-luna',
    question,
    safetyIdentifier,
    context,
    resources,
  }),
  processAskFn = processAsk,
  randomTokenFn = randomToken,
  hashFn = sha256Hex,
} = {}) {
  return async function handler(event = {}) {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'POST') {
      return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' }, { Allow: 'POST' })
    }

    let body
    try {
      body = parseJsonBody(event)
    } catch {
      return jsonResponse(400, { code: 'invalid_json', message: 'Request body must be valid JSON.' })
    }

    const mode = String(body.mode || '').trim().toLowerCase()
    const authorization = header(event, 'authorization')
    let actor = null
    if (authorization) {
      try {
        actor = await authenticate({ authorization })
      } catch (error) {
        if (error?.status === 401 || error?.status === 403) actor = null
        else return jsonResponse(500, { code: 'auth_error', message: 'Could not validate the MediQo session.' })
      }
      if (!actor) return jsonResponse(401, { code: 'invalid_session', message: 'Your MediQo session is no longer valid. Please sign in again.' })
    }
    if (mode === 'accreditation' && !actor) {
      return jsonResponse(401, { code: 'authentication_required', message: 'Sign in to ask questions about your accreditation workspace.' })
    }

    let server
    try {
      server = createServer()
    } catch {
      return jsonResponse(500, { code: 'server_not_configured', message: 'MediQo server configuration is incomplete.' })
    }

    const cookies = parseCookies(header(event, 'cookie'))
    let anonymousToken = cookies[ANONYMOUS_COOKIE_NAME] || ''
    let newAnonymousToken = false
    if (!actor && !anonymousToken) {
      anonymousToken = randomTokenFn()
      newAnonymousToken = true
    }

    let anonymousTokenHash = null
    try {
      if (anonymousToken) anonymousTokenHash = await hashFn(anonymousToken)
      if (actor) {
        actor = { ...actor, safetyIdentifier: await hashFn(`mediqo-user:${actor.userId}`) }
        if (anonymousTokenHash) {
          try {
            await server.claimAnonymous(anonymousTokenHash, actor.userId, actor.practiceId)
          } catch (error) {
            if (!String(error?.message || '').includes('anonymous_session_already_claimed')) throw error
          }
        }
      }

      let generateForRequest = generateAnswer
      if (mode === 'accreditation') {
        const cycle = await server.getOrCreateAccreditationCycle(actor.practiceId, body.cycleId || null)
        const [overview, missing, actions, evidence, resources] = await Promise.all([
          server.getAccreditationOverview({ practiceId: actor.practiceId, cycleId: cycle.id }),
          server.getAccreditationMissing({ practiceId: actor.practiceId, cycleId: cycle.id }),
          server.listAccreditationActions({ practiceId: actor.practiceId, cycleId: cycle.id }),
          server.listAccreditationEvidence({ practiceId: actor.practiceId, cycleId: cycle.id }),
          server.listAccreditationSources(),
        ])
        const context = compactAccreditationContext({
          cycleId: cycle.id,
          question: body.question,
          overview,
          missing,
          actions,
          evidence,
        })
        generateForRequest = ({ question, safetyIdentifier }) => generateAccreditationAnswer({
          question,
          safetyIdentifier,
          context,
          resources,
        })
      }

      const result = await processAskFn({
        question: body.question,
        conversationId: body.conversationId || null,
        actor,
        anonymousTokenHash,
      }, {
        reserveAnonymous: (tokenHash) => server.reserveAnonymous(tokenHash),
        completeAnonymous: (sessionId) => server.completeAnonymous(sessionId),
        releaseAnonymous: (sessionId) => server.releaseAnonymous(sessionId),
        persistAnswer: (payload) => server.persistAnswer(payload),
        generateAnswer: generateForRequest,
      })

      const headers = {}
      if (newAnonymousToken) {
        headers['Set-Cookie'] = buildCookie(ANONYMOUS_COOKIE_NAME, anonymousToken, {
          secure: isSecureRequest(event),
          maxAge: 31536000,
        })
      } else if (actor && anonymousToken) {
        headers['Set-Cookie'] = buildCookie(ANONYMOUS_COOKIE_NAME, '', {
          secure: isSecureRequest(event),
          maxAge: 0,
        })
      }
      return jsonResponse(result.statusCode, result.body, headers)
    } catch (error) {
      console.error('MediQo ask failed:', error?.message || error)
      return jsonResponse(500, { code: 'assistant_error', message: 'MediQo could not prepare an answer. Please try again.' })
    }
  }
}

export const handler = createAskHandler()
