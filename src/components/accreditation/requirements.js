import { escapeHtml } from '../../lib/html.js'
import { readinessLabel, readinessClass, verificationLabel } from './status.js'

const FILTERS = [
  ['ALL', 'All'],
  ['APPEARS_READY', 'Appears Ready'],
  ['NEEDS_ATTENTION', 'Needs Attention'],
  ['CONFIRMED_GAP', 'Confirmed Gap'],
  ['NOT_CHECKED', 'Not Checked'],
  ['P1', 'P1 priority'],
  ['CRITICAL', 'Critical safety'],
]

function applicabilityStatus(item) {
  return String(item?.applicabilityStatus || 'APPLICABLE').toUpperCase()
}

function matchesFilter(item, filter) {
  const applicability = applicabilityStatus(item)
  if (filter === 'ALL') return true
  if (filter === 'P1') return applicability !== 'NOT_APPLICABLE' && item.quickCheckPriority === 'P1'
  if (filter === 'CRITICAL') return applicability !== 'NOT_APPLICABLE' && Boolean(item.criticalSafetyArea)
  if (applicability !== 'APPLICABLE') return false
  return item.readinessStatus === filter
}

function readinessDisplay(item) {
  const applicability = applicabilityStatus(item)
  if (applicability === 'NOT_APPLICABLE') {
    return '<span class="applicability-pill not-applicable">Not Applicable</span>'
  }
  if (applicability === 'UNKNOWN') {
    return '<span class="applicability-pill needs-confirmation">Applicability not confirmed</span>'
  }
  return `<span class="readiness-pill ${readinessClass(item.readinessStatus)}">${escapeHtml(readinessLabel(item.readinessStatus))}</span>`
}

function evidenceLabel(count) {
  const value = Number(count || 0)
  return value > 0 ? String(value) : 'No evidence yet'
}

export function renderRequirementsView(requirements = [], { filter = 'ALL' } = {}) {
  const items = (Array.isArray(requirements) ? requirements : []).filter((item) => matchesFilter(item, filter))
  return `<section class="requirements-workspace">
    <div class="filter-tabs accreditation-filter-tabs">
      ${FILTERS.map(([value, label]) => `<button class="filter-tab ${filter === value ? 'active' : ''}" type="button" data-accreditation-filter="${value}">${escapeHtml(label)}</button>`).join('')}
    </div>
    <section class="panel requirements-live-panel">
      <div class="panel-heading"><div><h2>RACGP 5th Edition requirements</h2><p>See every requirement, where you're up to, and what to do next.</p></div><span class="count-pill">${items.length}</span></div>
      ${items.length ? `<div class="table-wrap"><table class="data-table accreditation-live-table"><thead><tr><th>Requirement</th><th>Classification</th><th>Readiness</th><th>Verification</th><th>Evidence</th><th>Priority</th></tr></thead><tbody>
        ${items.map((item) => `<tr data-accreditation-requirement="${escapeHtml(item.id || '')}" role="link" tabindex="0" aria-label="Open ${escapeHtml(item.indicator || item.id || 'requirement')}">
          <td><strong>${escapeHtml(item.indicator || item.id || '')}</strong><small>${escapeHtml(item.criterionDescription || item.plainEnglishRequirement || '')}</small>${item.criticalSafetyArea ? '<span class="critical-safety-badge">Critical safety</span>' : ''}</td>
          <td><span class="classification-pill ${item.classification === 'UNVERIFIED' ? 'validation-required' : ''}">${escapeHtml(item.classificationLabel || (item.classification === 'UNVERIFIED' ? 'Validation required' : item.classification || ''))}</span></td>
          <td>${readinessDisplay(item)}</td>
          <td>${escapeHtml(verificationLabel(item.verificationStatus))}</td>
          <td>${escapeHtml(evidenceLabel(item.evidenceCount))}</td>
          <td>${escapeHtml(item.quickCheckPriority || '')}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<div class="accreditation-empty-state"><h3>No requirements match this filter</h3><p>Choose another filter to continue reviewing the RACGP 5th Edition workspace.</p></div>'}
    </section>
  </section>`
}
