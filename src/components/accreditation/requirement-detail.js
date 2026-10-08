import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'
import { readinessLabel, readinessClass, verificationLabel } from './status.js'

function listBlock(title, items = [], empty = 'None recorded') {
  return `<section class="requirement-detail-block"><h3>${escapeHtml(title)}</h3>${items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</li>`).join('')}</ul>` : `<p class="muted-copy">${escapeHtml(empty)}</p>`}</section>`
}

function sourceLinks(sourceUrls = {}) {
  const entries = Object.entries(sourceUrls || {}).filter(([, url]) => /^https?:\/\//i.test(String(url || '')))
  if (!entries.length) return '<p class="muted-copy">No source link is available in the controlled dataset.</p>'
  return `<div class="requirement-source-links">${entries.map(([name, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${icon('external',14)} ${escapeHtml(name.toUpperCase())}</a>`).join('')}</div>`
}

export function renderRequirementDetail(requirement = {}) {
  const questions = Array.isArray(requirement.questions) ? requirement.questions : []
  const evidence = Array.isArray(requirement.evidenceCriteria) ? requirement.evidenceCriteria : []
  return `<section class="requirement-detail">
    <button type="button" class="conversation-back requirement-back" data-accreditation-view="requirements">${icon('chevron',15)} Back to requirements</button>
    <section class="panel requirement-detail-hero">
      <div><span class="eyebrow">${escapeHtml(requirement.criterion || 'RACGP 5TH EDITION')}</span><h2>${escapeHtml(requirement.indicator || requirement.id || '')} · ${escapeHtml(requirement.criterionDescription || '')}</h2><p>${escapeHtml(requirement.plainEnglishRequirement || '')}</p></div>
      <div class="requirement-detail-status"><span class="readiness-pill ${readinessClass(requirement.readinessStatus)}">${escapeHtml(readinessLabel(requirement.readinessStatus))}</span><span>${escapeHtml(verificationLabel(requirement.verificationStatus))}</span></div>
    </section>

    <div class="requirement-detail-grid">
      <section class="panel requirement-detail-main">
        <div class="requirement-reason"><span class="label">Why MediQo shows this status</span><p>${escapeHtml(requirement.statusReason || 'More information required.')}</p></div>
        <div class="requirement-fact-grid">
          ${listBlock('Known facts', requirement.knownFacts || [], 'No reliable practice facts recorded yet.')}
          ${listBlock('Unknown facts', requirement.unknownFacts || [], 'No unresolved facts recorded.')}
          ${listBlock('Potential gaps', requirement.potentialGaps || [], 'No potential gaps recorded.')}
          ${listBlock('Confirmed gaps', requirement.confirmedGaps || [], 'No confirmed gaps recorded.')}
        </div>
        ${listBlock('Recommended next action', requirement.recommendedActions || [], 'Continue gathering reliable practice information.')}
      </section>

      <aside class="requirement-detail-side">
        <section class="panel requirement-detail-block"><h3>Classification</h3><p>${escapeHtml(requirement.classificationLabel || requirement.classification || '')}</p></section>
        <section class="panel requirement-detail-block"><h3>Controlled sources</h3>${sourceLinks(requirement.sourceUrls)}</section>
      </aside>
    </div>

    <section class="panel requirement-config-section">
      <div class="panel-heading"><div><h2>Readiness questions</h2><p>Questions come from the controlled client dataset.</p></div></div>
      ${questions.length ? questions.map((question) => `<article class="requirement-question-config"><strong>${escapeHtml(question.wording || '')}</strong><p>${escapeHtml((question.answerOptions || []).join(' · '))}</p></article>`).join('') : '<div class="accreditation-empty-state"><p>No active question is configured for this requirement.</p></div>'}
    </section>

    <section class="panel requirement-config-section">
      <div class="panel-heading"><div><h2>Possible evidence</h2><p>Evidence types and assessment dimensions supplied by the workbook.</p></div></div>
      ${evidence.length ? evidence.map((item) => `<article class="requirement-evidence-config"><strong>${escapeHtml(item.evidenceType || '')}</strong><p>${escapeHtml(item.evidenceRule || '')}</p></article>`).join('') : '<div class="accreditation-empty-state"><p>No evidence criteria are configured for this requirement.</p></div>'}
    </section>
  </section>`
}
