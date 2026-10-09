const VERIFIED_STATES = new Set(['AI_REVIEWED', 'MANUALLY_VERIFIED'])

function clean(value) {
  return String(value ?? '').trim()
}

function lower(value) {
  return clean(value).toLowerCase()
}

function baseResult(previousState = {}) {
  return {
    applicabilityStatus: previousState.applicabilityStatus || 'UNKNOWN',
    readinessStatus: 'NOT_CHECKED',
    verificationStatus: previousState.verificationStatus || null,
    confidence: 0,
    statusReason: 'More information required.',
    knownFacts: Array.isArray(previousState.knownFacts) ? [...previousState.knownFacts] : [],
    unknownFacts: Array.isArray(previousState.unknownFacts) ? [...previousState.unknownFacts] : [],
    potentialGaps: Array.isArray(previousState.potentialGaps) ? [...previousState.potentialGaps] : [],
    confirmedGaps: Array.isArray(previousState.confirmedGaps) ? [...previousState.confirmedGaps] : [],
    recommendedActions: Array.isArray(previousState.recommendedActions) ? [...previousState.recommendedActions] : [],
    requiresReassessment: true,
  }
}

function answerFact(question, answerLabel) {
  const wording = clean(question?.wording) || 'Readiness question'
  return `${wording} — reported answer: ${answerLabel}`
}

function requirementLabel(requirement) {
  return clean(requirement?.plainEnglishRequirement) || clean(requirement?.indicator) || clean(requirement?.id) || 'this requirement'
}

function isUnknownAnswer(label) {
  return ["i'm not sure", 'i’m not sure', 'not sure', 'unknown'].includes(lower(label))
}

function isNotApplicableAnswer(label) {
  return lower(label).startsWith('not applicable')
}

function isNegativeAnswer(label) {
  const value = lower(label)
  return value === 'no' || value === 'not yet'
}

function isPartialAnswer(label) {
  const value = lower(label)
  return value === 'partly'
    || value === 'some'
    || value.startsWith('some ')
    || value === 'sometimes'
    || value === 'with limitations'
    || value === "we're doing this now"
    || value === 'we’re doing this now'
    || value === "we're working on one"
    || value === 'we’re working on one'
}

function isPositiveAnswer(label) {
  return lower(label).startsWith('yes')
}

export function assessRequirement({
  requirement,
  question,
  response,
  previousState = {},
} = {}) {
  const result = baseResult(previousState)
  const answerLabel = clean(response?.answerLabel)

  if (!requirement || requirement.active === false || requirement.contentValidationStatus === 'HOLD') {
    return {
      ...result,
      applicabilityStatus: 'UNKNOWN',
      readinessStatus: 'NOT_CHECKED',
      verificationStatus: null,
      confidence: 0,
      statusReason: 'This requirement is on HOLD pending accreditation-content validation.',
      unknownFacts: ['Current controlled requirement status needs validation before assessment.'],
      confirmedGaps: [],
      requiresReassessment: false,
    }
  }

  if (!answerLabel) {
    return {
      ...result,
      statusReason: 'More information required before this requirement can be assessed.',
      unknownFacts: [...result.unknownFacts, clean(question?.wording) || 'Readiness response is missing.'],
    }
  }

  const fact = answerFact(question, answerLabel)
  const verificationStatus = 'USER_REPORTED'

  if (isUnknownAnswer(answerLabel)) {
    return {
      ...result,
      applicabilityStatus: requirement.applicability === 'Universal' ? 'APPLICABLE' : 'UNKNOWN',
      readinessStatus: 'NOT_CHECKED',
      verificationStatus,
      confidence: 0.2,
      statusReason: 'More information required; the practice has reported that this fact is not currently known.',
      knownFacts: [...result.knownFacts, fact],
      unknownFacts: [...result.unknownFacts, requirementLabel(requirement)],
      confirmedGaps: [],
      recommendedActions: ['Confirm the missing fact or provide relevant evidence before reassessment.'],
    }
  }

  if (isNotApplicableAnswer(answerLabel)) {
    return {
      ...result,
      applicabilityStatus: 'NOT_APPLICABLE',
      readinessStatus: 'NOT_CHECKED',
      verificationStatus,
      confidence: 0.35,
      statusReason: 'The practice reports this requirement is not applicable; applicability remains separate from readiness and should be verified.',
      knownFacts: [...result.knownFacts, fact],
      unknownFacts: [...result.unknownFacts, 'Applicability has not yet been independently verified.'],
      confirmedGaps: [],
      recommendedActions: ['Verify the applicability condition before excluding this requirement from the active readiness check.'],
    }
  }

  if (isNegativeAnswer(answerLabel)) {
    const verifiedClassification = requirement.classification === 'MANDATORY' || requirement.classification === 'ASPIRATIONAL'
    if (!verifiedClassification) {
      return {
        ...result,
        applicabilityStatus: requirement.applicability === 'Universal' ? 'APPLICABLE' : 'UNKNOWN',
        readinessStatus: 'NEEDS_ATTENTION',
        verificationStatus,
        confidence: 0.45,
        statusReason: 'A negative user report needs attention, but this requirement classification is unverified and requires accreditation-content validation before a confirmed readiness conclusion.',
        knownFacts: [...result.knownFacts, fact],
        potentialGaps: [...result.potentialGaps, requirementLabel(requirement)],
        confirmedGaps: [],
        recommendedActions: ['Validate the controlled requirement classification, then confirm the reported gap and remediation needed.'],
      }
    }

    return {
      ...result,
      applicabilityStatus: requirement.applicability === 'Universal' ? 'APPLICABLE' : (previousState.applicabilityStatus || 'APPLICABLE'),
      readinessStatus: 'CONFIRMED_GAP',
      verificationStatus,
      confidence: 0.65,
      statusReason: 'The practice has explicitly reported that an applicable verified requirement element is not in place.',
      knownFacts: [...result.knownFacts, fact],
      potentialGaps: [],
      confirmedGaps: [...result.confirmedGaps, requirementLabel(requirement)],
      recommendedActions: ['Address the confirmed gap, record the corrective action, and re-check this requirement.'],
    }
  }

  if (isPartialAnswer(answerLabel)) {
    return {
      ...result,
      applicabilityStatus: requirement.applicability === 'Universal' ? 'APPLICABLE' : (previousState.applicabilityStatus || 'UNKNOWN'),
      readinessStatus: 'NEEDS_ATTENTION',
      verificationStatus,
      confidence: 0.5,
      statusReason: 'The practice reports partial implementation or coverage; more information and supporting evidence are needed.',
      knownFacts: [...result.knownFacts, fact],
      potentialGaps: [...result.potentialGaps, requirementLabel(requirement)],
      confirmedGaps: [],
      recommendedActions: ['Clarify what is incomplete and provide supporting evidence for the unresolved parts.'],
    }
  }

  if (isPositiveAnswer(answerLabel)) {
    const previousVerification = previousState.verificationStatus || null
    const verified = VERIFIED_STATES.has(previousVerification)
      && (!Array.isArray(previousState.confirmedGaps) || previousState.confirmedGaps.length === 0)

    if (verified) {
      return {
        ...result,
        applicabilityStatus: requirement.applicability === 'Universal' ? 'APPLICABLE' : (previousState.applicabilityStatus || 'APPLICABLE'),
        readinessStatus: 'APPEARS_READY',
        verificationStatus: previousVerification,
        confidence: previousVerification === 'MANUALLY_VERIFIED' ? 0.95 : 0.85,
        statusReason: 'The positive practice response is supported by an existing reviewed verification state and no confirmed gap is recorded.',
        knownFacts: [...result.knownFacts, fact],
        unknownFacts: [],
        potentialGaps: [],
        confirmedGaps: [],
        recommendedActions: [],
        requiresReassessment: false,
      }
    }

    return {
      ...result,
      applicabilityStatus: requirement.applicability === 'Universal' ? 'APPLICABLE' : (previousState.applicabilityStatus || 'UNKNOWN'),
      readinessStatus: 'NOT_CHECKED',
      verificationStatus,
      confidence: 0.4,
      statusReason: 'Reported complete — evidence not yet checked.',
      knownFacts: [...result.knownFacts, fact],
      unknownFacts: [...result.unknownFacts, 'Supporting evidence has not yet been reviewed.'],
      potentialGaps: [],
      confirmedGaps: [],
      recommendedActions: ['Upload or confirm supporting evidence, then re-check this requirement.'],
    }
  }

  return {
    ...result,
    applicabilityStatus: requirement.applicability === 'Universal' ? 'APPLICABLE' : 'UNKNOWN',
    readinessStatus: 'NOT_CHECKED',
    verificationStatus,
    confidence: 0.1,
    statusReason: 'More information required; the reported answer could not be mapped to controlled assessment logic.',
    knownFacts: [...result.knownFacts, fact],
    unknownFacts: [...result.unknownFacts, requirementLabel(requirement)],
    confirmedGaps: [],
    recommendedActions: ['Clarify the response using the configured answer options before reassessment.'],
  }
}
