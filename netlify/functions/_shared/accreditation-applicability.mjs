function clean(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return clean(value).toUpperCase()
}

function lower(value) {
  return clean(value).toLowerCase()
}

function stateValue(state, snake, camel) {
  return state?.[snake] ?? state?.[camel] ?? null
}

function practiceValue(context, camel, snake = '') {
  return context?.[camel] ?? (snake ? context?.[snake] : undefined) ?? null
}

function requirementText(requirement = {}) {
  return [
    requirement.applicability_rule,
    requirement.applicability,
    requirement.criterion_description,
    requirement.criterionDescription,
    requirement.plain_english_requirement,
    requirement.plainEnglishRequirement,
  ].filter(Boolean).join(' ')
}

function isUniversal(requirement = {}) {
  const rule = lower(requirement.applicability_rule || requirement.applicability)
  return !rule || rule === 'universal' || rule.includes('universal')
}

function isVaccineStorageRequirement(requirement = {}) {
  const text = lower(requirementText(requirement))
  return text.includes('vaccine') && (text.includes('store') || text.includes('storage') || text.includes('potency') || text.includes('cold chain'))
}

function responseLabel(response = {}) {
  return clean(response.answer_label ?? response.answerLabel)
}

function isPositiveReportedAnswer(value) {
  return lower(value).startsWith('yes')
}

export function deriveRequirementApplicability({ requirement = {}, state = {}, practiceContext = {} } = {}) {
  const existingStatus = upper(stateValue(state, 'applicability_status', 'applicabilityStatus'))
  const existingReason = clean(stateValue(state, 'applicability_reason', 'applicabilityReason'))

  if (isUniversal(requirement)) {
    return {
      status: 'APPLICABLE',
      reason: existingReason || 'This requirement applies to all practices.',
      source: existingStatus ? 'assessment' : 'requirement',
    }
  }

  if (isVaccineStorageRequirement(requirement)) {
    const vaccineStorage = upper(practiceValue(practiceContext, 'vaccineStorage', 'vaccine_storage'))
    const vaccinations = upper(practiceValue(practiceContext, 'vaccinations'))

    if (vaccineStorage === 'NO' && vaccinations === 'YES') {
      return {
        status: 'UNKNOWN',
        reason: 'You told MediQo your practice provides vaccinations but does not store vaccines onsite. Confirm this information before vaccine-storage requirements are assessed.',
        source: 'practice_profile_conflict',
      }
    }

    if (vaccineStorage === 'NO') {
      return {
        status: 'NOT_APPLICABLE',
        reason: 'Your practice has confirmed that it does not store vaccines onsite.',
        source: 'practice_profile',
      }
    }

    if (vaccineStorage === 'YES') {
      return {
        status: 'APPLICABLE',
        reason: 'Your practice has confirmed that it stores vaccines onsite.',
        source: 'practice_profile',
      }
    }
  }

  return {
    status: existingStatus || 'UNKNOWN',
    reason: existingReason || 'Applicability has not yet been confirmed.',
    source: existingStatus ? 'assessment' : 'unknown',
  }
}

export function effectiveRequirementState({ requirement = {}, state = {}, response = {}, practiceContext = {} } = {}) {
  const applicability = deriveRequirementApplicability({ requirement, state, practiceContext })
  const storedReadiness = upper(stateValue(state, 'readiness_status', 'readinessStatus')) || 'NOT_CHECKED'
  const verificationStatus = stateValue(state, 'verification_status', 'verificationStatus')
  const knownFacts = Array.isArray(state.known_facts) ? state.known_facts : (state.knownFacts || [])
  const storedUnknownFacts = Array.isArray(state.unknown_facts) ? state.unknown_facts : (state.unknownFacts || [])
  const potentialGaps = Array.isArray(state.potential_gaps) ? state.potential_gaps : (state.potentialGaps || [])
  const confirmedGaps = Array.isArray(state.confirmed_gaps) ? state.confirmed_gaps : (state.confirmedGaps || [])

  if (applicability.status === 'NOT_APPLICABLE' || applicability.source === 'practice_profile_conflict') {
    return {
      applicabilityStatus: applicability.status,
      applicabilityReason: applicability.reason,
      readinessStatus: 'NOT_CHECKED',
      verificationStatus,
      statusReason: applicability.reason,
      knownFacts,
      unknownFacts: applicability.status === 'UNKNOWN' ? [applicability.reason] : [],
      potentialGaps: [],
      confirmedGaps: [],
      recommendedActions: applicability.status === 'UNKNOWN' ? ['Confirm the conflicting practice information before reassessment.'] : [],
      lastAssessedAt: stateValue(state, 'last_assessed_at', 'lastAssessedAt'),
      requiresReassessment: applicability.status === 'UNKNOWN',
    }
  }

  if (
    verificationStatus === 'USER_REPORTED'
    && storedReadiness === 'NEEDS_ATTENTION'
    && isPositiveReportedAnswer(responseLabel(response))
    && potentialGaps.length === 0
    && confirmedGaps.length === 0
  ) {
    const evidenceUnknown = 'Supporting evidence has not yet been reviewed.'
    return {
      applicabilityStatus: applicability.status,
      applicabilityReason: applicability.reason,
      readinessStatus: 'NOT_CHECKED',
      verificationStatus,
      statusReason: 'Reported complete — evidence not yet checked.',
      knownFacts,
      unknownFacts: storedUnknownFacts.includes(evidenceUnknown) ? storedUnknownFacts : [...storedUnknownFacts, evidenceUnknown],
      potentialGaps: [],
      confirmedGaps: [],
      recommendedActions: ['Upload or confirm supporting evidence, then re-check this requirement.'],
      lastAssessedAt: stateValue(state, 'last_assessed_at', 'lastAssessedAt'),
      requiresReassessment: true,
    }
  }

  return {
    applicabilityStatus: applicability.status,
    applicabilityReason: applicability.reason,
    readinessStatus: storedReadiness,
    verificationStatus,
    statusReason: stateValue(state, 'status_reason', 'statusReason') || 'More information required.',
    knownFacts,
    unknownFacts: storedUnknownFacts,
    potentialGaps,
    confirmedGaps,
    recommendedActions: Array.isArray(state.recommended_actions) ? state.recommended_actions : (state.recommendedActions || []),
    lastAssessedAt: stateValue(state, 'last_assessed_at', 'lastAssessedAt'),
    requiresReassessment: stateValue(state, 'requires_reassessment', 'requiresReassessment') ?? true,
  }
}

export function isInformativeReadinessAnswer(answerLabel) {
  const value = lower(answerLabel)
  return Boolean(value) && !["i'm not sure", 'i’m not sure', 'not sure', 'unknown'].includes(value)
}
