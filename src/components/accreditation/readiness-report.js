import { escapeHtml } from '../../lib/html.js'

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function dateLabel(value) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function list(items = []) {
  const values = Array.isArray(items) ? items.filter(Boolean) : []
  if (!values.length) return '<p>None recorded in this review.</p>'
  return `<ul>${values.map((item) => `<li>${escapeHtml(typeof item === 'string' ? item : item.title || item.body || item.reason || '')}</li>`).join('')}</ul>`
}

function resources(items = []) {
  const values = Array.isArray(items) ? items.filter((item) => item?.url && item?.title) : []
  if (!values.length) return ''
  return `<div class="accreditation-report-resource-list">${values.map((item) => `<a class="secondary-button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`).join('')}</div>`
}

function renderSavedReport(report) {
  if (!report) return ''
  const payload = report.reportPayload || report.payload || {}
  return `<section class="panel accreditation-report-review">
    <span class="eyebrow">SAVED PRE-ACCREDITATION REVIEW · ${escapeHtml(dateLabel(report.generatedAt))}</span>
    <h3>${escapeHtml(report.title || 'Accreditation Readiness Report')}</h3>
    <p>${escapeHtml(payload.executiveSummary || 'This review records the practice state at the time it was generated.')}</p>
    <h4>Priority next actions</h4>${list(payload.priorityActions)}
    <h4>Confirmed gaps</h4>${list(payload.confirmedGaps)}
    <h4>Unresolved checks</h4>${list(payload.unresolvedChecks)}
    <h4>Evidence follow-ups</h4>${list(payload.evidenceFollowUps)}
    <h4>Positive readiness observations</h4>${list(payload.strengths)}
    <h4>Limitations</h4>${list(report.limitations || payload.limitations)}
    ${resources(report.sources || payload.sources)}
  </section>`
}

export function renderAccreditationReadinessReport(state = {}, { overview = {}, practiceName = 'Your practice' } = {}) {
  const live = state.live || {}
  const coverage = live.assessmentCoverage || overview.assessmentCoverage || {}
  const readiness = live.readiness || overview.readiness || {}
  const counts = live.statusCounts || overview.statusCounts || {}
  const actions = live.actions || {}
  const history = Array.isArray(state.history) ? state.history : []
  return `<section class="accreditation-report">
    <section class="panel accreditation-report-head">
      <div><span class="eyebrow">CURRENT READINESS</span><h2>${escapeHtml(practiceName)} readiness report</h2><p>See the current accreditation picture, then save a dated pre-accreditation review when you want a point-in-time record.</p></div>
      <button class="primary-button" type="button" data-accreditation-generate-report ${state.generating ? 'disabled' : ''}>${state.generating ? 'Running review…' : 'Run pre-accreditation review'}</button>
    </section>
    ${state.error ? `<div class="accreditation-report-error">${escapeHtml(state.error)}</div>` : ''}
    <div class="accreditation-report-stats">
      <button type="button" class="panel accreditation-report-stat" data-accreditation-filter="ALL"><small>Assessment coverage</small><strong>${number(coverage.percent)}%</strong><small>${number(coverage.assessed)} of ${number(coverage.total)} assessed</small></button>
      <button type="button" class="panel accreditation-report-stat" data-accreditation-filter="APPEARS_READY"><small>Appears ready</small><strong>${number(counts.APPEARS_READY)}</strong><small>Based on saved information</small></button>
      <button type="button" class="panel accreditation-report-stat" data-accreditation-filter="NEEDS_ATTENTION"><small>Needs attention</small><strong>${number(counts.NEEDS_ATTENTION)}</strong><small>Requires follow-up</small></button>
      <button type="button" class="panel accreditation-report-stat" data-accreditation-filter="CONFIRMED_GAP"><small>Confirmed gaps</small><strong>${number(counts.CONFIRMED_GAP)}</strong><small>Known gaps to address</small></button>
      <button type="button" class="panel accreditation-report-stat" data-accreditation-filter="NOT_CHECKED"><small>Not checked</small><strong>${number(counts.NOT_CHECKED)}</strong><small>Still unresolved</small></button>
      <button type="button" class="panel accreditation-report-stat" data-action="accreditation-open-missing-evidence"><small>Evidence follow-ups</small><strong>${number(live.evidenceFollowUpCount)}</strong><small>Reviews needing action</small></button>
    </div>
    <div class="accreditation-report-grid">
      <section class="panel accreditation-report-section">
        <h3>Current work</h3>
        <div class="accreditation-report-links">
          <a class="accreditation-report-link" href="/accreditation/requirements" data-nav="/accreditation/requirements"><span>Requirements needing attention</span><strong>${number(counts.NEEDS_ATTENTION) + number(counts.CONFIRMED_GAP)}</strong></a>
          <a class="accreditation-report-link" href="/accreditation/evidence" data-nav="/accreditation/evidence"><span>Evidence follow-ups</span><strong>${number(live.evidenceFollowUpCount)}</strong></a>
          <a class="accreditation-report-link" href="/accreditation/actions" data-nav="/accreditation/actions"><span>Open actions</span><strong>${number(actions.open) + number(actions.inProgress) + number(actions.blocked)}</strong></a>
          <a class="accreditation-report-link" href="/accreditation/actions" data-nav="/accreditation/actions"><span>Overdue actions</span><strong>${number(actions.overdue)}</strong></a>
        </div>
        <p class="rail-copy">Target assessment date: ${escapeHtml(dateLabel(live.targetAssessmentDate || overview.cycle?.targetAssessmentDate))}</p>
      </section>
      <section class="panel accreditation-report-section">
        <h3>Previous reviews</h3>
        <div class="accreditation-report-history">${history.length ? history.map((item) => `<button type="button" data-accreditation-report-id="${escapeHtml(item.id)}"><span class="accreditation-report-history-meta"><strong>${escapeHtml(dateLabel(item.generatedAt))}</strong><small>${number(item.coveragePercent)}% assessed</small></span><span>View</span></button>`).join('') : '<p class="rail-copy">No saved pre-accreditation reviews yet.</p>'}</div>
      </section>
    </div>
    ${renderSavedReport(state.selected)}
  </section>`
}
