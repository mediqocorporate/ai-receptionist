import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'
import { readinessLabel, readinessClass, READINESS_STATUSES } from './status.js'

function countCard(status, count) {
  return `<article class="accreditation-status-card ${readinessClass(status)}"><span>${escapeHtml(readinessLabel(status))}</span><strong>${Number(count || 0)}</strong></article>`
}

export function renderAccreditationOverview(overview = {}, { practiceName = 'Your practice' } = {}) {
  const standard = overview.standardVersion || {}
  const coverage = overview.coverage || { answered: 0, total: 0, percent: 0 }
  const statusCounts = overview.statusCounts || {}
  const assessedCount = Number(overview.assessedCount || 0)
  const noAssessment = assessedCount === 0
  const target = overview.cycle?.targetAssessmentDate
    ? new Date(overview.cycle.targetAssessmentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not set'

  return `<div class="accreditation-overview">
    <section class="accreditation-standard-banner">
      <div><span class="eyebrow">CURRENT FORMAL WORKSPACE</span><h2>RACGP 5th edition</h2><p>${escapeHtml(standard.name || 'RACGP Standards for general practices')} · assessment target: ${escapeHtml(target)}</p></div>
      <span class="accreditation-standard-badge">5th edition</span>
    </section>

    <section class="accreditation-overview-grid">
      <article class="panel accreditation-coverage-card">
        <span class="label">Quick Check coverage</span>
        <div class="coverage-number">${Number(coverage.percent || 0)}%</div>
        <p><strong>${Number(coverage.answered || 0)}</strong> of <strong>${Number(coverage.total || 0)}</strong> priority requirements answered for ${escapeHtml(practiceName)}.</p>
        <div class="coverage-bar" role="progressbar" aria-valuenow="${Number(coverage.percent || 0)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(0, Math.min(100, Number(coverage.percent || 0)))}%"></span></div>
        <button type="button" class="primary-button" data-accreditation-view="check">${icon('clipboard',16)} ${coverage.answered ? 'Continue Quick Check' : 'Start Quick Readiness Check'}</button>
      </article>

      <article class="panel accreditation-assessment-card">
        <span class="label">Readiness of assessed requirements</span>
        <h3>${noAssessment ? 'Not Checked yet' : `${assessedCount} requirement${assessedCount === 1 ? '' : 's'} assessed`}</h3>
        <p>${noAssessment ? 'MediQo will only show readiness after there is enough information to assess a requirement.' : 'Coverage and readiness are shown separately so answering more questions does not automatically improve readiness.'}</p>
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
