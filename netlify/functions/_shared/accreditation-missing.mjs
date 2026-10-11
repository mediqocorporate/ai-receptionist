const EVIDENCE_PROBLEM_STATUSES = new Map([
  ['OUTDATED', 'EVIDENCE_OUTDATED'],
  ['INCOMPLETE', 'EVIDENCE_INCOMPLETE'],
  ['CONFLICTING', 'EVIDENCE_CONFLICTING'],
  ['MORE_INFORMATION_REQUIRED', 'EVIDENCE_MORE_INFORMATION_REQUIRED'],
])

const ISSUE_WEIGHT = {
  CONFIRMED_GAP: 100,
  NEEDS_ATTENTION: 90,
  EVIDENCE_OUTDATED: 85,
  EVIDENCE_CONFLICTING: 84,
  EVIDENCE_INCOMPLETE: 83,
  EVIDENCE_MORE_INFORMATION_REQUIRED: 82,
  MISSING_POLICY: 80,
  MISSING_EVIDENCE: 78,
  EVIDENCE_REVIEW_PENDING: 70,
  APPLICABILITY_TO_CONFIRM: 60,
  RECHECK_REQUIRED: 50,
  NOT_CHECKED: 40,
}

function unique(items = []) {
  return [...new Set((Array.isArray(items) ? items : []).filter(Boolean))]
}

function criterionLooksLikePolicy(item = {}) {
  const text = `${item.evidenceType || item.type || ''} ${item.evidenceRule || item.rule || ''}`.toLowerCase()
  return /policy|procedure/.test(text)
}

function issuePriority(requirement, issueCodes) {
  const codes = new Set(issueCodes)
  if (codes.has('CONFIRMED_GAP')) return requirement.criticalSafetyArea ? 'CRITICAL' : 'HIGH'
  if ([...codes].some((code) => ['EVIDENCE_OUTDATED','EVIDENCE_CONFLICTING','EVIDENCE_INCOMPLETE','EVIDENCE_MORE_INFORMATION_REQUIRED'].includes(code))) {
    return requirement.criticalSafetyArea ? 'CRITICAL' : 'HIGH'
  }
  if (codes.has('NEEDS_ATTENTION') || codes.has('MISSING_POLICY') || codes.has('MISSING_EVIDENCE')) {
    return requirement.criticalSafetyArea || requirement.quickCheckPriority === 'P1' ? 'HIGH' : 'MEDIUM'
  }
  if (codes.has('EVIDENCE_REVIEW_PENDING') || codes.has('APPLICABILITY_TO_CONFIRM')) {
    return requirement.criticalSafetyArea || requirement.quickCheckPriority === 'P1' ? 'HIGH' : 'MEDIUM'
  }
  if (codes.has('RECHECK_REQUIRED')) return 'MEDIUM'
  return requirement.criticalSafetyArea || requirement.quickCheckPriority === 'P1' ? 'MEDIUM' : 'LOW'
}

function whyShown(requirement, issueCodes) {
  const codes = new Set(issueCodes)
  if (codes.has('CONFIRMED_GAP')) return requirement.statusReason || 'The practice has reported that this applicable requirement is not currently in place.'
  if (codes.has('NEEDS_ATTENTION')) return requirement.statusReason || 'The information currently recorded shows this requirement needs follow-up.'
  if (codes.has('EVIDENCE_OUTDATED')) return 'Mapped evidence has been reviewed and identified as outdated.'
  if (codes.has('EVIDENCE_CONFLICTING')) return 'Mapped evidence has been reviewed and conflicts with information recorded for this requirement.'
  if (codes.has('EVIDENCE_INCOMPLETE')) return 'Mapped evidence has been reviewed and is incomplete for this requirement.'
  if (codes.has('EVIDENCE_MORE_INFORMATION_REQUIRED')) return 'Evidence review found that more information is required before this requirement can be assessed.'
  if (codes.has('MISSING_POLICY')) return 'This assessed requirement expects policy or procedure evidence, but no active supporting file is currently mapped.'
  if (codes.has('MISSING_EVIDENCE')) return 'This assessed requirement does not yet have active supporting evidence mapped to it.'
  if (codes.has('EVIDENCE_REVIEW_PENDING')) return 'Supporting evidence is mapped, but it is still Not Reviewed. MediQo does not treat that evidence as sufficient until review is completed.'
  if (codes.has('APPLICABILITY_TO_CONFIRM')) return requirement.applicabilityReason || 'MediQo still needs a practice fact before it can confirm whether this requirement applies.'
  if (codes.has('RECHECK_REQUIRED')) return 'The stored assessment needs to be re-checked because relevant practice information has changed.'
  return requirement.statusReason || 'This requirement has not yet been assessed with enough information.'
}

function fallbackAction(issueCodes) {
  const codes = new Set(issueCodes)
  if (codes.has('CONFIRMED_GAP')) return 'Address the confirmed gap, record what changed, then re-check the requirement.'
  if (codes.has('NEEDS_ATTENTION')) return 'Review the requirement details and complete the recommended follow-up.'
  if (codes.has('EVIDENCE_OUTDATED')) return 'Upload or map the current version of the required evidence.'
  if (codes.has('EVIDENCE_INCOMPLETE')) return 'Complete the supporting evidence or add the missing material.'
  if (codes.has('EVIDENCE_CONFLICTING')) return 'Resolve the conflicting evidence and confirm which information is current.'
  if (codes.has('EVIDENCE_MORE_INFORMATION_REQUIRED')) return 'Provide the additional information requested by the evidence review.'
  if (codes.has('MISSING_POLICY')) return 'Upload or map the current policy or procedure that supports this requirement.'
  if (codes.has('MISSING_EVIDENCE')) return 'Upload or map supporting evidence for this requirement.'
  if (codes.has('EVIDENCE_REVIEW_PENDING')) return 'Review the mapped evidence against this requirement before relying on it for readiness.'
  if (codes.has('APPLICABILITY_TO_CONFIRM')) return 'Complete the relevant Practice Information so MediQo can confirm applicability.'
  if (codes.has('RECHECK_REQUIRED')) return 'Re-check this requirement using the latest practice information.'
  return 'Complete the readiness question for this requirement.'
}

function suggestedEvidenceCategory(criteria = []) {
  const text = (Array.isArray(criteria) ? criteria : [])
    .map((item) => `${item.type || ''} ${item.rule || ''}`)
    .join(' ')
    .toLowerCase()
  if (!text) return ''
  if (/policy|procedure/.test(text)) return 'POLICY_PROCEDURE'
  if (/register|log/.test(text)) return 'REGISTER'
  if (/training|credential|qualification/.test(text)) return 'TRAINING_CREDENTIAL'
  if (/certificate/.test(text)) return 'CERTIFICATE'
  if (/audit|report/.test(text)) return 'AUDIT_REPORT'
  if (/meeting|minutes/.test(text)) return 'MEETING_RECORD'
  if (/equipment|maintenance|calibration/.test(text)) return 'EQUIPMENT_MAINTENANCE'
  if (/patient feedback|survey/.test(text)) return 'PATIENT_FEEDBACK'
  return 'OTHER'
}

function linkedActionForRequirement(actions, requirementId) {
  const linked = (Array.isArray(actions) ? actions : []).filter((action) => action.requirementId === requirementId)
  return linked.find((action) => action.status !== 'DONE') || linked[0] || null
}

function maxIssueWeight(issueCodes) {
  return Math.max(0, ...issueCodes.map((code) => ISSUE_WEIGHT[code] || 0))
}

export function buildAccreditationMissing({ requirements = [], evidenceCriteria = [], evidence = [], actions = [] } = {}) {
  const criteriaByRequirement = new Map()
  for (const criterion of Array.isArray(evidenceCriteria) ? evidenceCriteria : []) {
    const requirementId = criterion.requirementId || criterion.requirement_id
    if (!requirementId) continue
    if (!criteriaByRequirement.has(requirementId)) criteriaByRequirement.set(requirementId, [])
    criteriaByRequirement.get(requirementId).push({
      type: criterion.evidenceType || criterion.evidence_type || 'Supporting evidence',
      role: criterion.role || '',
      rule: criterion.evidenceRule || criterion.evidence_rule || '',
    })
  }

  const activeEvidence = (Array.isArray(evidence) ? evidence : []).filter((item) => item?.status === 'ACTIVE')
  const evidenceByRequirement = new Map()
  for (const item of activeEvidence) {
    for (const mapping of Array.isArray(item.mappings) ? item.mappings : []) {
      const requirementId = mapping.requirementId || mapping.requirement_id
      if (!requirementId) continue
      if (!evidenceByRequirement.has(requirementId)) evidenceByRequirement.set(requirementId, [])
      evidenceByRequirement.get(requirementId).push(item)
    }
  }

  const items = []
  for (const requirement of Array.isArray(requirements) ? requirements : []) {
    if (!requirement?.id || requirement.applicabilityStatus === 'NOT_APPLICABLE') continue

    const issueCodes = []
    if (requirement.readinessStatus === 'CONFIRMED_GAP') issueCodes.push('CONFIRMED_GAP')
    else if (requirement.readinessStatus === 'NEEDS_ATTENTION') issueCodes.push('NEEDS_ATTENTION')

    const mappedEvidence = evidenceByRequirement.get(requirement.id) || []
    const evidenceAssessments = mappedEvidence.flatMap((item) => (Array.isArray(item.assessments) ? item.assessments : [])
      .filter((assessment) => !assessment.requirementId || assessment.requirementId === requirement.id))
    const problemStatuses = unique(evidenceAssessments.map((assessment) => EVIDENCE_PROBLEM_STATUSES.get(assessment.reviewStatus)).filter(Boolean))
    issueCodes.push(...problemStatuses)

    const hasSufficientReview = evidenceAssessments.some((assessment) => assessment.reviewStatus === 'SUFFICIENT_FOR_REVIEW')
    const hasPendingReview = mappedEvidence.length > 0 && !hasSufficientReview && evidenceAssessments.every((assessment) => !EVIDENCE_PROBLEM_STATUSES.has(assessment.reviewStatus))
    const assessedEnoughToExpectEvidence = Boolean(requirement.assessmentInformative) || ['CONFIRMED_GAP','NEEDS_ATTENTION','APPEARS_READY'].includes(requirement.readinessStatus)
    const criteria = criteriaByRequirement.get(requirement.id) || []

    if (assessedEnoughToExpectEvidence && mappedEvidence.length === 0) {
      issueCodes.push(criteria.some(criterionLooksLikePolicy) ? 'MISSING_POLICY' : 'MISSING_EVIDENCE')
    } else if (assessedEnoughToExpectEvidence && hasPendingReview) {
      issueCodes.push('EVIDENCE_REVIEW_PENDING')
    }

    if (requirement.applicabilityStatus === 'UNKNOWN') issueCodes.push('APPLICABILITY_TO_CONFIRM')
    if (requirement.requiresReassessment && requirement.lastAssessedAt) issueCodes.push('RECHECK_REQUIRED')
    if (requirement.readinessStatus === 'NOT_CHECKED' && !requirement.assessmentInformative && requirement.applicabilityStatus !== 'UNKNOWN') issueCodes.push('NOT_CHECKED')

    const uniqueIssues = unique(issueCodes).sort((a, b) => (ISSUE_WEIGHT[b] || 0) - (ISSUE_WEIGHT[a] || 0))
    if (!uniqueIssues.length) continue

    const linkedAction = linkedActionForRequirement(actions, requirement.id)
    const activeAction = linkedAction?.status === 'DONE' ? null : linkedAction
    const evidenceAction = evidenceAssessments.find((assessment) => assessment.recommendedAction)?.recommendedAction || ''
    const recommendedAction = Array.isArray(requirement.recommendedActions) ? requirement.recommendedActions.find(Boolean) : ''
    const expectedEvidence = criteria

    items.push({
      requirementId: requirement.id,
      indicator: requirement.indicator || requirement.id,
      title: requirement.criterionDescription || requirement.plainEnglishRequirement || requirement.indicator || requirement.id,
      classificationLabel: requirement.classificationLabel || requirement.classification || '',
      criticalSafetyArea: Boolean(requirement.criticalSafetyArea),
      quickCheckPriority: requirement.quickCheckPriority || '',
      readinessStatus: requirement.readinessStatus || 'NOT_CHECKED',
      verificationStatus: requirement.verificationStatus || null,
      priority: activeAction?.priority || issuePriority(requirement, uniqueIssues),
      issueCodes: uniqueIssues,
      whyShown: whyShown(requirement, uniqueIssues),
      nextAction: activeAction?.title || recommendedAction || evidenceAction || fallbackAction(uniqueIssues),
      expectedEvidence,
      suggestedEvidenceCategory: suggestedEvidenceCategory(expectedEvidence),
      evidenceCount: mappedEvidence.length,
      ownerName: linkedAction?.ownerName || '',
      dueDate: activeAction?.dueDate || null,
      actionStatus: linkedAction?.status || null,
      actionId: linkedAction?.id || null,
      sortWeight: maxIssueWeight(uniqueIssues),
    })
  }

  const priorityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
  items.sort((a, b) => (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
    || b.sortWeight - a.sortWeight
    || String(a.quickCheckPriority || '').localeCompare(String(b.quickCheckPriority || ''))
    || String(a.indicator || '').localeCompare(String(b.indicator || '')))

  const summary = {
    totalItems: items.length,
    confirmedGaps: items.filter((item) => item.issueCodes.includes('CONFIRMED_GAP')).length,
    needsAttention: items.filter((item) => item.issueCodes.includes('NEEDS_ATTENTION')).length,
    evidenceIssues: items.filter((item) => item.issueCodes.some((code) => code.startsWith('EVIDENCE_') || code === 'MISSING_EVIDENCE' || code === 'MISSING_POLICY')).length,
    applicabilityToConfirm: items.filter((item) => item.issueCodes.includes('APPLICABILITY_TO_CONFIRM')).length,
    notChecked: items.filter((item) => item.issueCodes.includes('NOT_CHECKED')).length,
    recheckRequired: items.filter((item) => item.issueCodes.includes('RECHECK_REQUIRED')).length,
  }

  return { summary, items: items.map(({ sortWeight, ...item }) => item) }
}
