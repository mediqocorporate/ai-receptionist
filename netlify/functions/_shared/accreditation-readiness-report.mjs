const FOLLOW_UP_REVIEW_STATUSES = new Set([
  'NOT_REVIEWED',
  'INCOMPLETE',
  'OUTDATED',
  'CONFLICTING',
  'MORE_INFORMATION_REQUIRED',
])

function take(items, limit) {
  return (Array.isArray(items) ? items : []).slice(0, limit)
}

export function buildAccreditationReadinessSnapshot({ overview = {}, missing = {}, actions = {}, evidence = [] } = {}) {
  const requirements = take(overview.requirements, 80)
    .filter((item) => String(item?.readinessStatus || 'NOT_CHECKED') !== 'NOT_CHECKED' || (Array.isArray(item?.unknownFacts) && item.unknownFacts.length))
    .map((item) => ({
      id: item.id,
      indicator: item.indicator,
      criterion: item.criterion,
      criterionDescription: item.criterionDescription,
      plainEnglishRequirement: item.plainEnglishRequirement,
      classification: item.classification,
      applicabilityStatus: item.applicabilityStatus,
      readinessStatus: item.readinessStatus,
      verificationStatus: item.verificationStatus,
      statusReason: item.statusReason,
      knownFacts: take(item.knownFacts, 8),
      unknownFacts: take(item.unknownFacts, 8),
      potentialGaps: take(item.potentialGaps, 8),
      confirmedGaps: take(item.confirmedGaps, 8),
      recommendedActions: take(item.recommendedActions, 8),
      evidenceCount: Number(item.evidenceCount || 0),
    }))

  const actionItems = take(actions.items, 60)
    .filter((item) => String(item?.status || '') !== 'DONE')
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
      overdue: Boolean(item.overdue),
    }))

  const evidenceItems = take(evidence, 60).map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    status: item.status,
    processingStatus: item.processingStatus,
    documentDate: item.documentDate,
    reviewDate: item.reviewDate,
    version: item.version,
    mappings: take(item.mappings, 20).map((mapping) => ({ requirementId: mapping.requirementId })),
    assessments: take(item.assessments, 20).map((assessment) => ({
      requirementId: assessment.requirementId,
      reviewStatus: assessment.reviewStatus,
      reason: assessment.reason,
      recommendedAction: assessment.recommendedAction,
      humanReviewRequired: assessment.humanReviewRequired,
    })),
  }))

  return {
    standardVersion: overview.standardVersion || null,
    targetAssessmentDate: overview.cycle?.targetAssessmentDate || null,
    assessmentCoverage: overview.assessmentCoverage || { assessed: 0, total: 0, percent: 0 },
    readiness: overview.readiness || { appearsReady: 0, assessed: 0, percent: 0 },
    statusCounts: overview.statusCounts || { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 0, NOT_CHECKED: 0 },
    requirements,
    missing: take(missing.items, 60).map((item) => ({
      requirementId: item.requirementId,
      indicator: item.indicator,
      title: item.title,
      reason: item.reason,
      priority: item.priority,
      evidenceType: item.evidenceType,
    })),
    actions: actionItems,
    actionSummary: actions.summary || {},
    evidence: evidenceItems,
  }
}

export function readinessLiveSummary(snapshot = {}) {
  let evidenceFollowUpCount = 0
  for (const item of Array.isArray(snapshot.evidence) ? snapshot.evidence : []) {
    if ((item.assessments || []).some((assessment) => FOLLOW_UP_REVIEW_STATUSES.has(String(assessment?.reviewStatus || '')))) {
      evidenceFollowUpCount += 1
    }
  }
  return {
    assessmentCoverage: snapshot.assessmentCoverage || {},
    readiness: snapshot.readiness || {},
    statusCounts: snapshot.statusCounts || {},
    actions: snapshot.actionSummary || {},
    evidenceFollowUpCount,
    targetAssessmentDate: snapshot.targetAssessmentDate || null,
  }
}
