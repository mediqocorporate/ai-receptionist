export const READINESS_STATUSES = Object.freeze([
  'APPEARS_READY',
  'NEEDS_ATTENTION',
  'CONFIRMED_GAP',
  'NOT_CHECKED',
])

const READINESS_LABELS = Object.freeze({
  APPEARS_READY: 'Appears Ready',
  NEEDS_ATTENTION: 'Needs Attention',
  CONFIRMED_GAP: 'Confirmed Gap',
  NOT_CHECKED: 'Not Checked',
})

const VERIFICATION_LABELS = Object.freeze({
  USER_REPORTED: 'User reported',
  EVIDENCE_UPLOADED: 'Evidence uploaded',
  AI_REVIEWED: 'AI reviewed',
  MANUALLY_VERIFIED: 'Manually verified',
})

export function readinessLabel(status) {
  return READINESS_LABELS[status] || READINESS_LABELS.NOT_CHECKED
}

export function readinessClass(status) {
  return String(status || 'NOT_CHECKED').toLowerCase().replaceAll('_', '-')
}

export function verificationLabel(status) {
  return status ? (VERIFICATION_LABELS[status] || String(status).replaceAll('_', ' ').toLowerCase()) : 'Not verified'
}
