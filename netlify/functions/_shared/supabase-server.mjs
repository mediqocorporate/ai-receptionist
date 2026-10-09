import { buildAccreditationPracticeInformation } from './accreditation-setup.mjs'
import { effectiveRequirementState, isInformativeReadinessAnswer } from './accreditation-applicability.mjs'

function readConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '')
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '')
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '')
  if (!url || !publishableKey) throw new Error('Supabase public server configuration is missing.')
  return { url, publishableKey, serviceRoleKey }
}

async function parseJson(response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body?.message || body?.error_description || body?.error || `Supabase request failed with status ${response.status}.`
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return body
}

export async function authenticateUser({ authorization, env = process.env, fetchImpl = fetch }) {
  if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) return null
  const { url, publishableKey } = readConfig(env)
  const headers = { apikey: publishableKey, Authorization: authorization, 'Content-Type': 'application/json' }

  const userResponse = await fetchImpl(`${url}/auth/v1/user`, { method: 'GET', headers })
  if (userResponse.status === 401 || userResponse.status === 403) return null
  const user = await parseJson(userResponse)

  const contextResponse = await fetchImpl(`${url}/rest/v1/rpc/get_current_account_context`, {
    method: 'POST',
    headers,
    body: '{}',
  })
  const contextRows = await parseJson(contextResponse)
  const context = Array.isArray(contextRows) ? contextRows[0] : contextRows
  if (!context?.practice_id) throw new Error('Authenticated MediQo user has no active practice membership.')

  return {
    userId: user.id,
    email: user.email || '',
    firstName: context.first_name || '',
    lastName: context.last_name || '',
    jobTitle: context.job_title || '',
    practiceId: context.practice_id,
    practiceName: context.practice_name || '',
    role: context.role || '',
    jurisdictions: Array.isArray(context.jurisdictions) ? context.jurisdictions : [],
  }
}

export function createSupabaseServer({ env = process.env, fetchImpl = fetch } = {}) {
  const config = readConfig(env)
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  const serviceHeaders = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    'Content-Type': 'application/json',
  }

  async function rpc(name, payload = {}) {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify(payload),
    })
    return parseJson(response)
  }

  async function table(path, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
      method,
      headers: { ...serviceHeaders, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return parseJson(response)
  }

  async function findAccreditationCycleRow(practiceId, cycleId = null) {
    const safePracticeId = encodeURIComponent(practiceId)
    const cycleFilter = cycleId ? `&id=eq.${encodeURIComponent(cycleId)}` : ''
    const rows = await table(
      `accreditation_cycles?select=*&practice_id=eq.${safePracticeId}&standard_version_id=eq.RACGP5&status=eq.ACTIVE${cycleFilter}&order=started_at.desc&limit=1`
    )
    return Array.isArray(rows) ? (rows[0] || null) : rows
  }

  return {
    async reserveAnonymous(tokenHash) {
      const rows = await rpc('reserve_anonymous_answer', { p_token_hash: tokenHash })
      const row = Array.isArray(rows) ? rows[0] : rows
      return {
        sessionId: row?.session_id || null,
        allowed: Boolean(row?.allowed),
        remaining: Number(row?.remaining_after_reservation ?? 0),
      }
    },

    async completeAnonymous(sessionId) {
      const rows = await rpc('complete_anonymous_answer', { p_session_id: sessionId })
      const row = Array.isArray(rows) ? rows[0] : rows
      return { successfulCount: Number(row?.successful_count ?? 0), remaining: Number(row?.remaining ?? 0) }
    },

    async releaseAnonymous(sessionId) {
      await rpc('release_anonymous_answer', { p_session_id: sessionId })
    },

    async claimAnonymous(tokenHash, userId, practiceId) {
      return rpc('claim_anonymous_session', { p_token_hash: tokenHash, p_user_id: userId, p_practice_id: practiceId })
    },

    async persistAnswer({ conversationId, userId, practiceId, anonymousSessionId, question, answerText, answerJson, model, responseId }) {
      const rows = await rpc('persist_question_answer', {
        p_conversation_id: conversationId,
        p_user_id: userId,
        p_practice_id: practiceId,
        p_anonymous_session_id: anonymousSessionId,
        p_question: question,
        p_answer_text: answerText,
        p_answer_json: answerJson,
        p_model: model,
        p_openai_response_id: responseId,
      })
      const row = Array.isArray(rows) ? rows[0] : rows
      return { conversationId: row?.conversation_id, questionLogId: row?.question_log_id }
    },

    async findAccreditationCycle(practiceId, cycleId = null) {
      return findAccreditationCycleRow(practiceId, cycleId)
    },

    async getOrCreateAccreditationCycle(practiceId, cycleId = null) {
      const existing = await findAccreditationCycleRow(practiceId, cycleId)
      if (existing) return existing
      if (cycleId) throw new Error('accreditation_cycle_not_found')

      const created = await table('accreditation_cycles', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: [{ practice_id: practiceId, standard_version_id: 'RACGP5', status: 'ACTIVE' }],
      })
      return Array.isArray(created) ? created[0] : created
    },

    async getAccreditationAgencies() {
      const rows = await table('accreditation_agencies?select=id,name&is_active=eq.true&order=name.asc')
      return Array.isArray(rows) ? rows : []
    },

    async setupAccreditationWorkspace({
      practiceId,
      userId,
      journeyStatus = 'NOT_SURE',
      assessmentScheduled = null,
      targetAssessmentDate = null,
      accreditingAgencyId = null,
      practiceContext = {},
    }) {
      let cycle = await findAccreditationCycleRow(practiceId)
      if (!cycle) {
        const created = await table('accreditation_cycles', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: [{
            practice_id: practiceId,
            standard_version_id: 'RACGP5',
            status: 'ACTIVE',
            target_assessment_date: assessmentScheduled === true ? targetAssessmentDate : null,
          }],
        })
        cycle = Array.isArray(created) ? created[0] : created
      } else {
        const updated = await table(
          `accreditation_cycles?id=eq.${encodeURIComponent(cycle.id)}&practice_id=eq.${encodeURIComponent(practiceId)}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: { target_assessment_date: assessmentScheduled === true ? targetAssessmentDate : null },
          },
        )
        cycle = Array.isArray(updated) ? (updated[0] || cycle) : (updated || cycle)
      }

      const profileRows = await table('accreditation_practice_profiles?on_conflict=practice_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: [{
          practice_id: practiceId,
          journey_status: journeyStatus,
          assessment_scheduled: assessmentScheduled,
          accrediting_agency_id: accreditingAgencyId,
          practice_context: practiceContext || {},
          fact_provenance: {
            journey_status: 'Accreditation setup',
            assessment_scheduled: 'Accreditation setup',
            accrediting_agency: accreditingAgencyId ? 'Accreditation setup' : 'Not provided',
            practice_context: 'Accreditation setup',
          },
          setup_completed_at: new Date().toISOString(),
          created_by_user_id: userId,
        }],
      })
      const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows
      return { cycle, profile }
    },

    async getAccreditationPracticeInformation({ practiceId, cycleId = null }) {
      const [practiceRows, profileRows, agencyRows] = await Promise.all([
        table(`practices?select=id,name,jurisdictions,practice_type&id=eq.${encodeURIComponent(practiceId)}&limit=1`),
        table(`accreditation_practice_profiles?select=*&practice_id=eq.${encodeURIComponent(practiceId)}&limit=1`),
        table('accreditation_agencies?select=id,name&is_active=eq.true&order=name.asc'),
      ])
      const practice = Array.isArray(practiceRows) ? practiceRows[0] : practiceRows
      const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows
      const agencies = Array.isArray(agencyRows) ? agencyRows : []
      const cycle = await findAccreditationCycleRow(practiceId, cycleId)
      return buildAccreditationPracticeInformation({ practice, profile, cycle, agencies })
    },

    async getPracticeRequirement({ practiceId, cycleId, requirementId }) {
      const rows = await table(
        `practice_requirements?select=*&practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}&requirement_id=eq.${encodeURIComponent(requirementId)}&limit=1`
      )
      return Array.isArray(rows) ? (rows[0] || null) : rows
    },

    async getAccreditationQuestion({ questionId }) {
      const questionRows = await table(
        `accreditation_questions?select=*&id=eq.${encodeURIComponent(questionId)}&is_active=eq.true&limit=1`
      )
      const question = Array.isArray(questionRows) ? questionRows[0] : questionRows
      if (!question) throw new Error('accreditation_question_not_found')

      const [requirementRows, optionRows] = await Promise.all([
        table(
          `accreditation_requirements?select=*&id=eq.${encodeURIComponent(question.requirement_id)}&is_active=eq.true&limit=1`
        ),
        table(
          `accreditation_answer_options?select=question_id,option_order,label,option_type,default_branch_behaviour&question_id=eq.${encodeURIComponent(questionId)}&order=option_order.asc`
        ),
      ])
      const requirement = Array.isArray(requirementRows) ? requirementRows[0] : requirementRows
      if (!requirement) throw new Error('accreditation_requirement_not_found')
      const answerOptions = (Array.isArray(optionRows) ? optionRows : [])
        .map((row) => row.label)
        .filter(Boolean)

      return { ...question, answer_options: answerOptions, requirement }
    },

    async saveReadinessResponse({
      practiceId,
      cycleId,
      requirementId,
      questionId,
      userId,
      answerLabel,
      answerDetail = {},
      verificationStatus = 'USER_REPORTED',
    }) {
      await table(
        `readiness_responses?practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}&question_id=eq.${encodeURIComponent(questionId)}&superseded_at=is.null`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: { superseded_at: new Date().toISOString() },
        },
      )

      const rows = await table('readiness_responses', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: [{
          practice_id: practiceId,
          cycle_id: cycleId,
          requirement_id: requirementId,
          question_id: questionId,
          user_id: userId,
          answer_label: answerLabel,
          answer_detail: answerDetail || {},
          verification_status: verificationStatus,
        }],
      })
      return Array.isArray(rows) ? rows[0] : rows
    },

    async upsertPracticeRequirementAssessment({ practiceId, cycleId, requirementId, assessment }) {
      const rows = await table('practice_requirements?on_conflict=cycle_id,requirement_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: [{
          practice_id: practiceId,
          cycle_id: cycleId,
          requirement_id: requirementId,
          applicability_status: assessment.applicabilityStatus,
          readiness_status: assessment.readinessStatus,
          verification_status: assessment.verificationStatus,
          confidence: assessment.confidence,
          status_reason: assessment.statusReason,
          known_facts: assessment.knownFacts || [],
          unknown_facts: assessment.unknownFacts || [],
          potential_gaps: assessment.potentialGaps || [],
          confirmed_gaps: assessment.confirmedGaps || [],
          recommended_actions: assessment.recommendedActions || [],
          last_assessed_at: new Date().toISOString(),
          requires_reassessment: Boolean(assessment.requiresReassessment),
        }],
      })
      return Array.isArray(rows) ? rows[0] : rows
    },

    async getAccreditationOverview({ practiceId, cycleId }) {
      const [cycleRows, standardRows, requirementRows, questionRows, optionRows, evidenceLinkRows, assessmentRows, responseRows, profileRows] = await Promise.all([
        table(
          `accreditation_cycles?select=*&id=eq.${encodeURIComponent(cycleId)}&practice_id=eq.${encodeURIComponent(practiceId)}&limit=1`
        ),
        table('accreditation_standard_versions?select=*&id=eq.RACGP5&workspace_type=eq.CURRENT&is_active=eq.true&limit=1'),
        table('accreditation_requirements?select=*&standard_version_id=eq.RACGP5&is_active=eq.true&order=quick_check_priority.asc,national_not_met_rank.asc.nullslast,id.asc'),
        table('accreditation_questions?select=*&is_active=eq.true&order=quick_check_priority.asc,id.asc'),
        table('accreditation_answer_options?select=*&order=question_id.asc,option_order.asc'),
        table(
          `accreditation_evidence_requirement_links?select=requirement_id,evidence_id&practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}&is_active=eq.true`
        ),
        table(
          `practice_requirements?select=*&practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}`
        ),
        table(
          `readiness_responses?select=*&practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}&superseded_at=is.null&order=answered_at.desc`
        ),
        table(
          `accreditation_practice_profiles?select=practice_context&practice_id=eq.${encodeURIComponent(practiceId)}&limit=1`
        ),
      ])

      const cycle = Array.isArray(cycleRows) ? cycleRows[0] : cycleRows
      const standard = Array.isArray(standardRows) ? standardRows[0] : standardRows
      if (!cycle || !standard) throw new Error('accreditation_cycle_not_found')

      const requirements = Array.isArray(requirementRows) ? requirementRows : []
      const questions = Array.isArray(questionRows) ? questionRows : []
      const options = Array.isArray(optionRows) ? optionRows : []
      const evidenceLinks = Array.isArray(evidenceLinkRows) ? evidenceLinkRows : []
      const assessments = Array.isArray(assessmentRows) ? assessmentRows : []
      const responses = Array.isArray(responseRows) ? responseRows : []
      const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows
      const practiceContext = profile?.practice_context && typeof profile.practice_context === 'object'
        ? profile.practice_context
        : {}

      const assessmentByRequirement = new Map(assessments.map((row) => [row.requirement_id, row]))
      const responseByRequirement = new Map()
      for (const row of responses) {
        if (!responseByRequirement.has(row.requirement_id)) responseByRequirement.set(row.requirement_id, row)
      }
      const effectiveByRequirement = new Map(
        requirements.map((requirement) => [
          requirement.id,
          effectiveRequirementState({
            requirement,
            state: assessmentByRequirement.get(requirement.id) || {},
            response: responseByRequirement.get(requirement.id) || {},
            practiceContext,
          }),
        ])
      )
      const responseByQuestion = new Map(responses.map((row) => [row.question_id, row]))
      const p1Requirements = requirements.filter((row) => row.quick_check_priority === 'P1')
      const p1Ids = new Set(p1Requirements.map((row) => row.id))
      const answeredRequirementIds = new Set(
        responses.filter((row) => p1Ids.has(row.requirement_id)).map((row) => row.requirement_id)
      )

      const statusCounts = {
        APPEARS_READY: 0,
        NEEDS_ATTENTION: 0,
        CONFIRMED_GAP: 0,
        NOT_CHECKED: 0,
      }
      for (const requirement of requirements) {
        const status = effectiveByRequirement.get(requirement.id)?.readinessStatus || 'NOT_CHECKED'
        if (Object.hasOwn(statusCounts, status)) statusCounts[status] += 1
        else statusCounts.NOT_CHECKED += 1
      }

      const questionsWithOptions = questions.map((question) => ({
        ...question,
        answerOptions: options
          .filter((option) => option.question_id === question.id)
          .sort((a, b) => a.option_order - b.option_order)
          .map((option) => option.label),
      }))
      const nextQuestion = questionsWithOptions.find(
        (question) => p1Ids.has(question.requirement_id)
          && effectiveByRequirement.get(question.requirement_id)?.applicabilityStatus !== 'NOT_APPLICABLE'
          && !responseByQuestion.has(question.id)
      ) || null

      const coverageTotal = p1Requirements.length
      const coverageAnswered = answeredRequirementIds.size
      const coveragePercent = coverageTotal ? Math.round((coverageAnswered / coverageTotal) * 100) : 0

      const mandatoryApplicable = requirements.filter(
        (requirement) => requirement.classification === 'MANDATORY'
          && effectiveByRequirement.get(requirement.id)?.applicabilityStatus === 'APPLICABLE'
      )
      const applicableMandatoryIds = new Set(mandatoryApplicable.map((requirement) => requirement.id))
      const informativeResponseIds = new Set(
        responses
          .filter((response) => applicableMandatoryIds.has(response.requirement_id) && isInformativeReadinessAnswer(response.answer_label))
          .map((response) => response.requirement_id)
      )
      const assessmentCoverage = {
        assessed: informativeResponseIds.size,
        total: mandatoryApplicable.length,
        percent: mandatoryApplicable.length ? Math.round((informativeResponseIds.size / mandatoryApplicable.length) * 100) : 0,
      }
      const appearsReady = mandatoryApplicable.filter(
        (requirement) => informativeResponseIds.has(requirement.id)
          && effectiveByRequirement.get(requirement.id)?.readinessStatus === 'APPEARS_READY'
      ).length
      const readiness = {
        appearsReady,
        assessed: assessmentCoverage.assessed,
        percent: assessmentCoverage.assessed ? Math.round((appearsReady / assessmentCoverage.assessed) * 100) : 0,
      }
      const unresolvedApplicabilityCount = requirements.filter(
        (requirement) => requirement.classification === 'MANDATORY'
          && effectiveByRequirement.get(requirement.id)?.applicabilityStatus === 'UNKNOWN'
      ).length

      const highestGap = requirements.find(
        (requirement) => effectiveByRequirement.get(requirement.id)?.readinessStatus === 'CONFIRMED_GAP'
      )
      const highestAttention = requirements.find(
        (requirement) => effectiveByRequirement.get(requirement.id)?.readinessStatus === 'NEEDS_ATTENTION'
      )
      const displayRequirement = (requirement) => {
        const plain = String(requirement?.plain_english_requirement || '')
        return /plain-english readiness assessment for/i.test(plain)
          ? (requirement?.criterion_description || requirement?.indicator || '')
          : (plain || requirement?.criterion_description || requirement?.indicator || '')
      }

      let nextAction = 'Start the Quick Readiness Check.'
      if (highestGap) nextAction = `Address confirmed gap: ${highestGap.indicator} — ${displayRequirement(highestGap)}`
      else if (highestAttention) nextAction = `Review: ${highestAttention.indicator} — ${displayRequirement(highestAttention)}`
      else if (coverageAnswered > 0 && nextQuestion) nextAction = 'Continue the Quick Readiness Check.'
      else if (!nextQuestion && coverageTotal > 0) nextAction = 'Review evidence for assessed requirements.'

      const presentationRequirements = requirements.map((requirement) => {
        const state = effectiveByRequirement.get(requirement.id) || {}
        const evidenceCount = new Set(
          evidenceLinks.filter((row) => row.requirement_id === requirement.id).map((row) => row.evidence_id)
        ).size
        return {
          id: requirement.id,
          indicator: requirement.indicator,
          criterion: requirement.criterion,
          criterionDescription: requirement.criterion_description,
          plainEnglishRequirement: requirement.plain_english_requirement,
          classification: requirement.classification,
          classificationLabel: requirement.classification === 'UNVERIFIED'
            ? 'Validation required'
            : requirement.classification === 'MANDATORY'
              ? 'Mandatory'
              : 'Aspirational',
          applicabilityStatus: state.applicabilityStatus || 'UNKNOWN',
          applicabilityReason: state.applicabilityReason || 'Applicability has not yet been confirmed.',
          readinessStatus: state.readinessStatus || 'NOT_CHECKED',
          verificationStatus: state.verificationStatus || null,
          evidenceCount,
          quickCheckPriority: requirement.quick_check_priority,
          criticalSafetyArea: Boolean(requirement.critical_safety_area),
          lastAssessedAt: state.lastAssessedAt || null,
          requiresReassessment: state.requiresReassessment ?? true,
        }
      })

      return {
        cycle: {
          id: cycle.id,
          practiceId: cycle.practice_id,
          standardVersionId: cycle.standard_version_id,
          targetAssessmentDate: cycle.target_assessment_date,
          status: cycle.status,
          startedAt: cycle.started_at,
        },
        standardVersion: {
          id: standard.id,
          code: standard.code,
          name: standard.name,
          edition: standard.edition,
          workspaceType: standard.workspace_type,
        },
        coverage: {
          answered: coverageAnswered,
          total: coverageTotal,
          percent: coveragePercent,
        },
        assessmentCoverage,
        readiness,
        unresolvedApplicabilityCount,
        statusCounts,
        assessedCount: assessmentCoverage.assessed,
        totalRequirements: requirements.length,
        requirements: presentationRequirements,
        nextQuestion: nextQuestion ? {
          id: nextQuestion.id,
          requirementId: nextQuestion.requirement_id,
          wording: nextQuestion.wording,
          whyWeAsk: nextQuestion.why_we_ask,
          answerOptions: nextQuestion.answerOptions,
          priority: requirementRows.find((row) => row.id === nextQuestion.requirement_id)?.quick_check_priority || 'P1',
        } : null,
        nextAction,
      }
    },

    async getAccreditationComprehensiveCheck({ practiceId, cycleId }) {
      const [requirementRows, questionRows, optionRows, assessmentRows, responseRows, profileRows] = await Promise.all([
        table('accreditation_requirements?select=id,indicator,criterion_description,classification,applicability_rule,plain_english_requirement,quick_check_priority,national_not_met_rank,is_active&standard_version_id=eq.RACGP5&is_active=eq.true&order=quick_check_priority.asc,national_not_met_rank.asc.nullslast,id.asc'),
        table('accreditation_questions?select=id,requirement_id,wording,why_we_ask,is_active&is_active=eq.true&order=id.asc'),
        table('accreditation_answer_options?select=question_id,option_order,label&order=question_id.asc,option_order.asc'),
        table(
          `practice_requirements?select=*&practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}`
        ),
        table(
          `readiness_responses?select=requirement_id,question_id,answer_label,answered_at&practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}&superseded_at=is.null&order=answered_at.desc`
        ),
        table(
          `accreditation_practice_profiles?select=practice_context&practice_id=eq.${encodeURIComponent(practiceId)}&limit=1`
        ),
      ])

      const requirements = Array.isArray(requirementRows) ? requirementRows : []
      const questions = Array.isArray(questionRows) ? questionRows : []
      const options = Array.isArray(optionRows) ? optionRows : []
      const assessments = Array.isArray(assessmentRows) ? assessmentRows : []
      const responses = Array.isArray(responseRows) ? responseRows : []
      const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows
      const practiceContext = profile?.practice_context && typeof profile.practice_context === 'object'
        ? profile.practice_context
        : {}

      const stateByRequirement = new Map(assessments.map((row) => [row.requirement_id, row]))
      const responseByRequirement = new Map()
      for (const row of responses) {
        if (!responseByRequirement.has(row.requirement_id)) responseByRequirement.set(row.requirement_id, row)
      }
      const effectiveByRequirement = new Map(
        requirements.map((requirement) => [
          requirement.id,
          effectiveRequirementState({
            requirement,
            state: stateByRequirement.get(requirement.id) || {},
            response: responseByRequirement.get(requirement.id) || {},
            practiceContext,
          }),
        ])
      )
      const responseByQuestion = new Map(responses.map((row) => [row.question_id, row]))
      const questionByRequirement = new Map()
      for (const question of questions) {
        if (!questionByRequirement.has(question.requirement_id)) questionByRequirement.set(question.requirement_id, question)
      }

      const mandatory = requirements.filter(
        (requirement) => requirement.classification === 'MANDATORY'
          && effectiveByRequirement.get(requirement.id)?.applicabilityStatus === 'APPLICABLE'
          && questionByRequirement.has(requirement.id)
      )
      const answeredIds = new Set(
        mandatory
          .filter((requirement) => responseByQuestion.has(questionByRequirement.get(requirement.id).id))
          .map((requirement) => requirement.id)
      )
      const nextRequirement = mandatory.find((requirement) => !answeredIds.has(requirement.id)) || null
      const next = nextRequirement ? questionByRequirement.get(nextRequirement.id) : null
      const coverageTotal = mandatory.length
      const coverageAnswered = answeredIds.size

      return {
        coverage: {
          answered: coverageAnswered,
          total: coverageTotal,
          percent: coverageTotal ? Math.round((coverageAnswered / coverageTotal) * 100) : 0,
        },
        nextQuestion: next ? {
          id: next.id,
          requirementId: next.requirement_id,
          indicator: nextRequirement.indicator,
          wording: next.wording,
          whyWeAsk: next.why_we_ask,
          priority: nextRequirement.quick_check_priority,
          answerOptions: options
            .filter((option) => option.question_id === next.id)
            .sort((a, b) => a.option_order - b.option_order)
            .map((option) => option.label),
        } : null,
        aspirationalCount: requirements.filter(
          (requirement) => requirement.classification === 'ASPIRATIONAL'
            && effectiveByRequirement.get(requirement.id)?.applicabilityStatus === 'APPLICABLE'
        ).length,
        classificationPendingCount: requirements.filter(
          (requirement) => requirement.classification === 'UNVERIFIED'
            && effectiveByRequirement.get(requirement.id)?.applicabilityStatus !== 'NOT_APPLICABLE'
        ).length,
      }
    },

    async getAccreditationRequirement({ practiceId, cycleId, requirementId }) {
      const [requirementRows, questionRows, evidenceRows, branchRows, stateRows, responseRows, profileRows] = await Promise.all([
        table(
          `accreditation_requirements?select=*&id=eq.${encodeURIComponent(requirementId)}&standard_version_id=eq.RACGP5&is_active=eq.true&limit=1`
        ),
        table(
          `accreditation_questions?select=*&requirement_id=eq.${encodeURIComponent(requirementId)}&is_active=eq.true&order=id.asc`
        ),
        table(
          `accreditation_evidence_criteria?select=*&requirement_id=eq.${encodeURIComponent(requirementId)}&order=evidence_type.asc`
        ),
        table(
          `accreditation_branching_rules?select=*&requirement_id=eq.${encodeURIComponent(requirementId)}&order=branch_order.asc`
        ),
        table(
          `practice_requirements?select=*&practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}&requirement_id=eq.${encodeURIComponent(requirementId)}&limit=1`
        ),
        table(
          `readiness_responses?select=*&practice_id=eq.${encodeURIComponent(practiceId)}&cycle_id=eq.${encodeURIComponent(cycleId)}&requirement_id=eq.${encodeURIComponent(requirementId)}&superseded_at=is.null&order=answered_at.desc&limit=1`
        ),
        table(
          `accreditation_practice_profiles?select=practice_context&practice_id=eq.${encodeURIComponent(practiceId)}&limit=1`
        ),
      ])
      const requirement = Array.isArray(requirementRows) ? requirementRows[0] : requirementRows
      if (!requirement) throw new Error('accreditation_requirement_not_found')

      const questions = Array.isArray(questionRows) ? questionRows : []
      const questionIds = new Set(questions.map((row) => row.id))
      const allOptions = questionIds.size
        ? await table(
            `accreditation_answer_options?select=*&question_id=in.(${[...questionIds].map(encodeURIComponent).join(',')})&order=question_id.asc,option_order.asc`
          )
        : []
      const options = Array.isArray(allOptions) ? allOptions : []
      const state = Array.isArray(stateRows) ? (stateRows[0] || {}) : (stateRows || {})
      const response = Array.isArray(responseRows) ? responseRows[0] : responseRows
      const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows
      const practiceContext = profile?.practice_context && typeof profile.practice_context === 'object'
        ? profile.practice_context
        : {}
      const effectiveState = effectiveRequirementState({ requirement, state, response: response || {}, practiceContext })
      const sourceUrls = requirement.source_urls && typeof requirement.source_urls === 'object'
        ? requirement.source_urls
        : {}

      return {
        id: requirement.id,
        indicator: requirement.indicator,
        criterion: requirement.criterion,
        criterionDescription: requirement.criterion_description,
        classification: requirement.classification,
        classificationLabel: requirement.classification === 'UNVERIFIED' ? 'Validation required' : requirement.classification,
        plainEnglishRequirement: requirement.plain_english_requirement,
        applicabilityRule: requirement.applicability_rule,
        applicabilityStatus: effectiveState.applicabilityStatus,
        applicabilityReason: effectiveState.applicabilityReason,
        quickCheckPriority: requirement.quick_check_priority,
        criticalSafetyArea: requirement.critical_safety_area,
        contentValidationStatus: requirement.content_validation_status,
        sourceUrls,
        readinessStatus: effectiveState.readinessStatus,
        verificationStatus: effectiveState.verificationStatus,
        statusReason: effectiveState.statusReason,
        knownFacts: effectiveState.knownFacts,
        unknownFacts: effectiveState.unknownFacts.length ? effectiveState.unknownFacts : (effectiveState.readinessStatus === 'NOT_CHECKED' ? ['More information or reviewed evidence is required.'] : []),
        potentialGaps: effectiveState.potentialGaps,
        confirmedGaps: effectiveState.confirmedGaps,
        recommendedActions: effectiveState.recommendedActions,
        lastAssessedAt: effectiveState.lastAssessedAt,
        requiresReassessment: effectiveState.requiresReassessment,
        questions: questions.map((question) => ({
          id: question.id,
          wording: question.wording,
          purpose: question.purpose,
          whyWeAsk: question.why_we_ask,
          evidencePrompt: question.evidence_prompt,
          answerOptions: options
            .filter((option) => option.question_id === question.id)
            .sort((a, b) => a.option_order - b.option_order)
            .map((option) => option.label),
        })),
        branchingRules: Array.isArray(branchRows) ? branchRows : [],
        evidenceCriteria: Array.isArray(evidenceRows) ? evidenceRows.map((row) => ({
          evidenceType: row.evidence_type,
          role: row.role,
          evidenceRule: row.evidence_rule,
          assessmentDimensions: row.assessment_dimensions || [],
        })) : [],
        currentResponse: response ? {
          questionId: response.question_id,
          answerLabel: response.answer_label,
          answerDetail: response.answer_detail || {},
          verificationStatus: response.verification_status,
          answeredAt: response.answered_at,
        } : null,
      }
    },

    async getPracticeSummary(practiceId) {
      const rows = await table(
        `practices?select=id,name,jurisdictions,practice_type&id=eq.${encodeURIComponent(practiceId)}&limit=1`
      )
      return Array.isArray(rows) ? (rows[0] || null) : rows
    },

    async listPracticeDocuments(practiceId) {
      const rows = await table(
        `practice_documents?select=id,document_group_id,title,document_type,considerations,version,status,source_template_id,linked_requirement_ids,created_at,updated_at&practice_id=eq.${encodeURIComponent(practiceId)}&status=neq.ARCHIVED&order=updated_at.desc`
      )
      return Array.isArray(rows) ? rows : []
    },

    async savePracticeDocument({
      practiceId,
      userId,
      title,
      documentType,
      considerations = '',
      content,
      sourceTemplateId = null,
      linkedRequirementIds = [],
    }) {
      const rows = await table('practice_documents', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: [{
          practice_id: practiceId,
          user_id: userId,
          title,
          document_type: documentType,
          considerations,
          content,
          version: 1,
          status: 'SAVED',
          source_template_id: sourceTemplateId,
          linked_requirement_ids: linkedRequirementIds,
        }],
      })
      return Array.isArray(rows) ? rows[0] : rows
    },

    async upsertCrmJob({ userId, practiceId, eventType, payload }) {
      const rows = await table('crm_sync_jobs?on_conflict=user_id,event_type', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: [{ user_id: userId, practice_id: practiceId, event_type: eventType, payload, status: 'pending' }],
      })
      return Array.isArray(rows) ? rows[0] : rows
    },

    async updateCrmJob(jobId, patch) {
      const rows = await table(`crm_sync_jobs?id=eq.${encodeURIComponent(jobId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: patch,
      })
      return Array.isArray(rows) ? rows[0] : rows
    },
  }
}
