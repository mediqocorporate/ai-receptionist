import { reports } from '../data/reports.js'
import { demoQuestions } from '../data/demo-questions.js'
import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

const seededAdviceIds = ['mandatory-training', 'accreditation-certificates', 'privacy-misdirected-email']

export function accreditationSummary(overview = null) {
  const counts = overview?.statusCounts || {}
  const coverage = overview?.coverage || {}
  return {
    coveragePercent: Number(coverage.percent || 0),
    assessedCount: Number(overview?.assessedCount || 0),
    appearsReady: Number(counts.APPEARS_READY || 0),
    needsAttention: Number(counts.NEEDS_ATTENTION || 0),
    confirmedGaps: Number(counts.CONFIRMED_GAP || 0),
    notChecked: Number(counts.NOT_CHECKED || overview?.totalRequirements || 0),
  }
}

function reportMetric(report, overview = null) {
  if (report.id !== 'accreditation') return report.metric
  const summary = accreditationSummary(overview)
  return summary.assessedCount ? `${summary.coveragePercent}% checked` : 'Not Checked'
}

function recentAdvice(savedAnswerIds = []) {
  const ids = [...new Set([...seededAdviceIds, ...savedAnswerIds])]
  return ids.map((id) => demoQuestions.find((item) => item.id === id)).filter(Boolean).slice(0, 5)
}

function previewBody(reportId, savedAnswerIds = [], accreditationOverview = null) {
  if (reportId === 'accreditation') {
    const summary = accreditationSummary(accreditationOverview)
    return `<div class="report-preview-kpis"><div><span>Quick Check coverage</span><strong>${summary.coveragePercent}%</strong></div><div><span>Appears Ready</span><strong>${summary.appearsReady}</strong></div><div><span>Needs Attention</span><strong>${summary.needsAttention}</strong></div></div><ul class="report-preview-list"><li>Confirmed Gap: ${summary.confirmedGaps}</li><li>Not Checked: ${summary.notChecked}</li><li>Open Accreditation Assistant for requirement-level evidence and next actions.</li></ul>`
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

function questionActivityTable(questionLog = []) {
  const rows = Array.isArray(questionLog) ? questionLog.slice(-25).reverse() : []
  if (!rows.length) return '<div class="question-activity-empty">No logged-in questions have been recorded in this browser yet.</div>'
  return `<div class="question-activity-table-wrap"><table class="question-activity-table"><thead><tr><th>Question</th><th>User</th><th>Contact</th><th>Practice</th><th>Asked</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.question || '')}</td><td>${escapeHtml(item.userName || '')}</td><td>${escapeHtml(item.email || '')}</td><td>${escapeHtml(item.practiceName || '')}</td><td>${escapeHtml(item.askedAt ? new Date(item.askedAt).toLocaleString() : '')}</td></tr>`).join('')}</tbody></table></div>`
}

export function renderReportsPage({ savedAnswerIds = [], accreditationOverview = null, questionLog = [] } = {}) {
  const advice = recentAdvice(savedAnswerIds)
  return `<section class="feature-page reports-page"><div class="page-heading-row"><div><span class="eyebrow">PRACTICE REPORTS</span><h1>Practice reports</h1><p>Simple summaries for the areas a practice manager needs to keep moving.</p></div></div><div class="report-grid">${reports.map((report)=>`<article class="report-card"><div class="report-top"><span class="report-icon">${icon(report.id==='training'?'activity':'bar-chart',22)}</span><span class="metric-pill">${escapeHtml(reportMetric(report, accreditationOverview))}</span></div><h2>${escapeHtml(report.title)}</h2><p>${escapeHtml(report.description)}</p><div class="card-actions"><button type="button" class="text-button" data-action="preview-report" data-report-id="${report.id}">${icon('eye',15)} Preview</button><button type="button" class="secondary-button small" data-action="download-report" data-report-id="${report.id}">${icon('download',15)} Download</button></div></article>`).join('')}</div><section class="panel recent-advice"><div class="panel-heading"><div><h2>Recent advice</h2><p>Useful answers saved by your practice team.</p></div></div><div class="recent-advice-list">${advice.map((item) => `<div class="advice-row"><span class="advice-icon">${icon('bookmark',18)}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.intro)}</span></div></div>`).join('')}</div><div class="recent-advice-hint">${icon('bookmark',16)} Save any assistant answer to keep it in your practice reports.</div></section><section class="panel question-activity-panel"><div class="panel-heading"><div><h2>Question activity</h2><p>Questions asked by signed-in users in this demo browser.</p></div></div>${questionActivityTable(questionLog)}</section></section>`
}

export function renderReportDialog(reportId, { savedAnswerIds = [], accreditationOverview = null } = {}) {
  const report = reports.find((item) => item.id === reportId) || reports[0]
  return `<div class="dialog-backdrop" data-dialog="report"><section class="dialog report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-preview-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button><div class="report-preview-heading"><span class="report-icon">${icon(report.id==='training'?'activity':'bar-chart',22)}</span><div><span class="eyebrow">REPORT PREVIEW</span><h2 id="report-preview-title">${escapeHtml(report.title)}</h2><p>${escapeHtml(report.description)}</p></div></div>${previewBody(report.id, savedAnswerIds, accreditationOverview)}<div class="dialog-actions"><button class="secondary-button" type="button" data-action="download-report" data-report-id="${report.id}">${icon('download',15)} Download</button><button class="primary-button" type="button" data-action="close-dialog">Done</button></div></section></div>`
}
