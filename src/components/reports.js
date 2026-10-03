import { reports } from '../data/reports.js'
import { demoQuestions } from '../data/demo-questions.js'
import { accreditationItems } from '../data/accreditation.js'
import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

const seededAdviceIds = ['mandatory-training', 'accreditation-certificates', 'privacy-misdirected-email']

export function accreditationSummary(overrides = {}) {
  const items = accreditationItems.map((item) => ({ ...item, status: overrides[item.id] || item.status }))
  const ready = items.filter((item) => item.status === 'Ready').length
  return {
    score: Math.round((ready / items.length) * 100),
    priorityGaps: items.filter((item) => item.status === 'Action required').length,
    upcomingExpiry: items.filter((item) => item.status === 'Expiring soon').length,
  }
}

function reportMetric(report, overrides = {}) {
  if (report.id !== 'accreditation') return report.metric
  return `${accreditationSummary(overrides).score}% ready`
}

function recentAdvice(savedAnswerIds = []) {
  const ids = [...new Set([...seededAdviceIds, ...savedAnswerIds])]
  return ids.map((id) => demoQuestions.find((item) => item.id === id)).filter(Boolean).slice(0, 5)
}

function previewBody(reportId, savedAnswerIds = [], accreditationOverrides = {}) {
  if (reportId === 'accreditation') {
    const summary = accreditationSummary(accreditationOverrides)
    return `<div class="report-preview-kpis"><div><span>Current readiness</span><strong>${summary.score}%</strong></div><div><span>Priority gaps</span><strong>${summary.priorityGaps}</strong></div><div><span>Upcoming expiry</span><strong>${summary.upcomingExpiry}</strong></div></div><ul class="report-preview-list"><li>Clinical staff CPR evidence is due for review.</li><li>Complaints handling evidence needs attention.</li><li>GP credentials register has incomplete records.</li></ul>`
  }
  if (reportId === 'policies') {
    return `<div class="report-preview-kpis"><div><span>Current policies</span><strong>14</strong></div><div><span>Due for review</span><strong>3</strong></div><div><span>Priority areas</span><strong>2</strong></div></div><ul class="report-preview-list"><li>Privacy and confidentiality policy is current.</li><li>Complaints handling procedure is available in the library.</li><li>Business continuity policy review is upcoming.</li></ul>`
  }
  if (reportId === 'training') {
    return `<div class="report-preview-kpis"><div><span>Due soon</span><strong>4</strong></div><div><span>Current</span><strong>18</strong></div><div><span>Needs evidence</span><strong>2</strong></div></div><ul class="report-preview-list"><li>Clinical staff CPR evidence — 18 Oct 2026.</li><li>Staff training register — evidence incomplete.</li><li>Cold-chain monitoring evidence — 21 Oct 2026.</li></ul>`
  }
  const advice = recentAdvice(savedAnswerIds)
  return `<div class="report-preview-advice">${advice.map((item) => `<div class="advice-row"><span class="advice-icon">${icon('bookmark', 17)}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.intro)}</small></div></div>`).join('')}</div>`
}

export function renderReportsPage({ savedAnswerIds = [], accreditationOverrides = {} } = {}) {
  const advice = recentAdvice(savedAnswerIds)
  return `<section class="feature-page reports-page"><div class="page-heading-row"><div><span class="eyebrow">PRACTICE REPORTS</span><h1>Practice reports</h1><p>Simple summaries for the areas a practice manager needs to keep moving.</p></div></div><div class="report-grid">${reports.map((report)=>`<article class="report-card"><div class="report-top"><span class="report-icon">${icon(report.id==='training'?'activity':'bar-chart',22)}</span><span class="metric-pill">${escapeHtml(reportMetric(report, accreditationOverrides))}</span></div><h2>${escapeHtml(report.title)}</h2><p>${escapeHtml(report.description)}</p><div class="card-actions"><button type="button" class="text-button" data-action="preview-report" data-report-id="${report.id}">${icon('eye',15)} Preview</button><button type="button" class="secondary-button small" data-action="download-report" data-report-id="${report.id}">${icon('download',15)} Download</button></div></article>`).join('')}</div><section class="panel recent-advice"><div class="panel-heading"><div><h2>Recent advice</h2><p>Useful answers saved by your practice team.</p></div></div><div class="recent-advice-list">${advice.map((item) => `<div class="advice-row"><span class="advice-icon">${icon('bookmark',18)}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.intro)}</span></div></div>`).join('')}</div><div class="recent-advice-hint">${icon('bookmark',16)} Save any assistant answer to keep it in your practice reports.</div></section></section>`
}

export function renderReportDialog(reportId, { savedAnswerIds = [], accreditationOverrides = {} } = {}) {
  const report = reports.find((item) => item.id === reportId) || reports[0]
  return `<div class="dialog-backdrop" data-dialog="report"><section class="dialog report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-preview-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button><div class="report-preview-heading"><span class="report-icon">${icon(report.id==='training'?'activity':'bar-chart',22)}</span><div><span class="eyebrow">REPORT PREVIEW</span><h2 id="report-preview-title">${escapeHtml(report.title)}</h2><p>${escapeHtml(report.description)}</p></div></div>${previewBody(report.id, savedAnswerIds, accreditationOverrides)}<div class="dialog-actions"><button class="secondary-button" type="button" data-action="download-report" data-report-id="${report.id}">${icon('download',15)} Download</button><button class="primary-button" type="button" data-action="close-dialog">Done</button></div></section></div>`
}
