import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'
import { readinessLabel, readinessClass, READINESS_STATUSES } from './status.js'

function countCard(status, count) {
  return `<button type="button" class="accreditation-status-card ${readinessClass(status)}" data-accreditation-filter="${escapeHtml(status)}"><span>${escapeHtml(readinessLabel(status))}</span><strong>${Number(count || 0)}</strong></button>`
}

function percent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)))
}

export function renderAccreditationOverview(overview = {}, { practiceName = 'Your practice' } = {}) {
  const standard = overview.standardVersion || {}
  const quickCoverage = overview.coverage || { answered: 0, total: 0, percent: 0 }
  const statusCounts = overview.statusCounts || {}
  const assessedCount = Number(overview.assessedCount || 0)
  const totalRequirements = Number(overview.totalRequirements || 0)
  const assessmentCoverage = overview.assessmentCoverage || {
    assessed: assessedCount,
    total: totalRequirements,
    percent: totalRequirements ? Math.round((assessedCount / totalRequirements) * 100) : 0,
  }
  const readiness = overview.readiness || {
    appearsReady: Number(statusCounts.APPEARS_READY || 0),
    assessed: assessedCount,
    percent: assessedCount ? Math.round((Number(statusCounts.APPEARS_READY || 0) / assessedCount) * 100) : 0,
  }
  const unresolvedApplicabilityCount = Number(overview.unresolvedApplicabilityCount || 0)
  const noAssessment = Number(assessmentCoverage.assessed || 0) === 0
  const target = overview.cycle?.targetAssessmentDate
    ? new Date(overview.cycle.targetAssessmentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not set'
  const quickCheckComplete = Number(quickCoverage.total || 0) > 0 && Number(quickCoverage.answered || 0) >= Number(quickCoverage.total || 0)
  const quickCheckLabel = quickCheckComplete ? 'Review Quick Check' : quickCoverage.answered ? 'Continue Quick Check' : 'Start Quick Readiness Check'

  return `<div class="accreditation-overview">
    <section class="accreditation-standard-banner">
      <div><span class="eyebrow">CURRENT FORMAL WORKSPACE</span><h2>RACGP 5th edition</h2><p>${escapeHtml(standard.name || 'RACGP Standards for general practices')} · assessment target: ${escapeHtml(target)}</p></div>
      <span class="accreditation-standard-badge">5th edition</span>
    </section>

    <section class="accreditation-overview-grid">
      <article class="panel accreditation-coverage-card">
        <span class="label">Assessment coverage</span>
        <div class="coverage-number">${percent(assessmentCoverage.percent)}%</div>
        <p><strong>${Number(assessmentCoverage.assessed || 0)}</strong> of <strong>${Number(assessmentCoverage.total || 0)}</strong> currently applicable mandatory requirements have enough information to assess.</p>
        <div class="coverage-bar" role="progressbar" aria-label="Assessment coverage" aria-valuenow="${percent(assessmentCoverage.percent)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent(assessmentCoverage.percent)}%"></span></div>
        ${unresolvedApplicabilityCount ? `<p class="coverage-caveat"><strong>${unresolvedApplicabilityCount}</strong> requirement${unresolvedApplicabilityCount === 1 ? '' : 's'} still need applicability confirmation.</p>` : ''}
        <div class="quick-check-summary"><span>Quick Check</span><strong>${Number(quickCoverage.answered || 0)} of ${Number(quickCoverage.total || 0)}</strong><small>${percent(quickCoverage.percent)}% of priority questions answered</small></div>
        <button type="button" class="primary-button" data-accreditation-view="check">${icon('clipboard',16)} ${quickCheckLabel}</button>
      </article>

      <article class="panel accreditation-assessment-card">
        <span class="label">Readiness of assessed requirements</span>
        <div class="coverage-number readiness-percentage">${percent(readiness.percent)}%</div>
        <h3>${noAssessment ? 'Not checked yet' : `${Number(readiness.appearsReady || 0)} of ${Number(readiness.assessed || 0)} assessed requirements currently appear ready`}</h3>
        <p>${noAssessment ? 'MediQo will only show readiness after there is enough information to assess an applicable mandatory requirement.' : 'Assessment coverage and readiness are separate. Needs Attention does not receive partial readiness credit.'}</p>
        <div class="accreditation-status-grid">
          ${READINESS_STATUSES.map((status) => countCard(status, statusCounts[status])).join('')}
        </div>
      </article>
    </section>

    <section class="panel accreditation-next-action">
      <div class="future-icon">${icon('sparkle',20)}</div>
      <div><span class="label">Next recommended action</span><h3>${escapeHtml(overview.nextAction || 'Start the Quick Readiness Check.')}</h3><p>Recommendations are based on the controlled RACGP 5th Edition workspace and the information currently known to MediQo.</p></div>
      <button class="secondary-button" type="button" data-accreditation-view="requirements">View requirements</button>
    </section>
  </div>`
}
