import { assessRequirement } from './_shared/accreditation-assessment.mjs'
import { authenticateUser, createSupabaseServer } from './_shared/supabase-server.mjs'
import { jsonResponse, parseJsonBody } from './_shared/http.mjs'

function header(event, name) {
  const headers = event?.headers || {}
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || ''
}

function mapRequirement(row = {}) {
  return {
    id: row.id,
    indicator: row.indicator,
    classification: row.classification,
    contentValidationStatus: row.content_validation_status,
    active: row.is_active !== false,
    applicability: row.applicability_rule,
    plainEnglishRequirement: row.plain_english_requirement,
  }
}

function mapQuestion(row = {}) {
  return {
    id: row.id,
    requirementId: row.requirement_id,
    wording: row.wording,
    answerOptions: Array.isArray(row.answer_options) ? row.answer_options : [],
  }
}

function mapPreviousState(row) {
  if (!row) return {}
  return {
    applicabilityStatus: row.applicability_status,
    readinessStatus: row.readiness_status,
    verificationStatus: row.verification_status,
    confidence: row.confidence,
    statusReason: row.status_reason,
    knownFacts: row.known_facts || [],
    unknownFacts: row.unknown_facts || [],
    potentialGaps: row.potential_gaps || [],
    confirmedGaps: row.confirmed_gaps || [],
    recommendedActions: row.recommended_actions || [],
    requiresReassessment: row.requires_reassessment,
  }
}

export function createAccreditationHandler({
  env = process.env,
  authenticate = ({ authorization }) => authenticateUser({ authorization, env }),
  createServer = () => createSupabaseServer({ env }),
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

    const authorization = header(event, 'authorization')
    if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) {
      return jsonResponse(401, { code: 'authentication_required', message: 'Sign in to use the Accreditation Assistant.' })
    }

    let actor
    try {
      actor = await authenticate({ authorization })
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) actor = null
      else {
        console.error('MediQo accreditation auth failed:', error?.message || error)
        return jsonResponse(500, { code: 'auth_error', message: 'Could not validate the MediQo session.' })
      }
    }
    if (!actor?.userId || !actor?.practiceId) {
      return jsonResponse(401, { code: 'invalid_session', message: 'Your MediQo session is no longer valid. Please sign in again.' })
    }

    let server
    try {
      server = createServer()
    } catch (error) {
      console.error('MediQo accreditation server setup failed:', error?.message || error)
      return jsonResponse(500, { code: 'server_not_configured', message: 'MediQo accreditation services are not configured.' })
    }

    const action = String(body.action || '').trim()
    try {
      if (action === 'overview') {
        const cycle = await server.getOrCreateAccreditationCycle(actor.practiceId, body.cycleId || null)
        const overview = await server.getAccreditationOverview({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
        })
        return jsonResponse(200, { overview })
      }

      if (action === 'requirement') {
        const requirementId = String(body.requirementId || '').trim()
        if (!requirementId) {
          return jsonResponse(400, { code: 'requirement_required', message: 'Requirement ID is required.' })
        }
        const cycle = await server.getOrCreateAccreditationCycle(actor.practiceId, body.cycleId || null)
        const requirement = await server.getAccreditationRequirement({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          requirementId,
        })
        return jsonResponse(200, { requirement, cycleId: cycle.id })
      }

      if (action === 'answer') {
        const questionId = String(body.questionId || '').trim()
        const answerLabel = String(body.answerLabel || '').trim()
        if (!questionId || !answerLabel) {
          return jsonResponse(400, { code: 'answer_required', message: 'Question ID and answer are required.' })
        }

        const cycle = await server.getOrCreateAccreditationCycle(actor.practiceId, body.cycleId || null)
        const configured = await server.getAccreditationQuestion({ questionId })
        const question = mapQuestion(configured)
        const requirement = mapRequirement(configured.requirement)

        if (!question.answerOptions.includes(answerLabel)) {
          return jsonResponse(400, { code: 'invalid_answer', message: 'Choose one of the configured answer options.' })
        }

        const previous = await server.getPracticeRequirement({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          requirementId: requirement.id,
        })
        const assessment = assessRequirement({
          requirement,
          question,
          response: { answerLabel, answerDetail: body.answerDetail || {} },
          previousState: mapPreviousState(previous),
        })

        await server.saveReadinessResponse({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          requirementId: requirement.id,
          questionId,
          userId: actor.userId,
          answerLabel,
          answerDetail: body.answerDetail || {},
          verificationStatus: assessment.verificationStatus || 'USER_REPORTED',
        })
        const practiceRequirement = await server.upsertPracticeRequirementAssessment({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          requirementId: requirement.id,
          assessment,
        })
        const overview = await server.getAccreditationOverview({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
        })

        return jsonResponse(200, {
          cycleId: cycle.id,
          assessment,
          practiceRequirement,
          overview,
        })
      }

      return jsonResponse(400, { code: 'invalid_action', message: 'Choose overview, answer or requirement.' })
    } catch (error) {
      const message = String(error?.message || '')
      if (message === 'accreditation_cycle_not_found') {
        return jsonResponse(404, { code: 'cycle_not_found', message: 'Accreditation cycle was not found for this practice.' })
      }
      if (message === 'accreditation_question_not_found') {
        return jsonResponse(404, { code: 'question_not_found', message: 'Accreditation question was not found.' })
      }
      if (message === 'accreditation_requirement_not_found') {
        return jsonResponse(404, { code: 'requirement_not_found', message: 'Accreditation requirement was not found.' })
      }
      console.error('MediQo accreditation failed:', error?.message || error)
      return jsonResponse(500, { code: 'accreditation_error', message: 'MediQo could not load accreditation readiness. Please try again.' })
    }
  }
}

export const handler = createAccreditationHandler()
