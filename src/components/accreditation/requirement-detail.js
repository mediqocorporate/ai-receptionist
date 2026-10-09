import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'
import { readinessLabel, readinessClass, verificationLabel } from './status.js'
import { evidenceCategoryLabel, evidenceReviewLabel } from './evidence.js'

function listBlock(title, items = [], empty = 'None recorded') {
  return `<section class="requirement-detail-block"><h3>${escapeHtml(title)}</h3>${items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</li>`).join('')}</ul>` : `<p class="muted-copy">${escapeHtml(empty)}</p>`}</section>`
}

function sourceLinks(sourceUrls = {}) {
  const entries = Object.entries(sourceUrls || {}).filter(([, url]) => /^https?:\/\//i.test(String(url || '')))
  if (!entries.length) return '<p class="muted-copy">No source link is available in the controlled dataset.</p>'
  return `<div class="requirement-source-links">${entries.map(([name, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${icon('external',14)} ${escapeHtml(name.toUpperCase())}</a>`).join('')}</div>`
}

function isTemplatePlainEnglish(value = '') {
  return /plain-english readiness assessment for/i.test(String(value))
}

function readinessQuestion(requirement, question) {
  if (!question) return ''
  const currentAnswer = requirement.currentResponse?.questionId === question.id
    ? requirement.currentResponse?.answerLabel
    : ''
  const options = Array.isArray(question.answerOptions) ? question.answerOptions : []
  return `<section class="panel requirement-readiness-question">
    <div><span class="eyebrow">READINESS QUESTION</span><h3>${escapeHtml(question.wording || '')}</h3>${currentAnswer ? `<p>Current answer: <strong>${escapeHtml(currentAnswer)}</strong></p>` : '<p>Choose the factual answer you know today. You can change this later.</p>'}</div>
    <div class="readiness-answer-grid">
      ${options.map((option) => `<button type="button" class="readiness-answer-option ${option === currentAnswer ? 'selected' : ''}" data-accreditation-answer data-question-id="${escapeHtml(question.id || '')}" data-answer-label="${escapeHtml(option)}" data-return-requirement-id="${escapeHtml(requirement.id || '')}" aria-pressed="${option === currentAnswer ? 'true' : 'false'}"><span>${escapeHtml(option)}</span>${icon('chevron',16)}</button>`).join('')}
    </div>
  </section>`
}

function mappedEvidenceSection(requirement, evidenceItems = []) {
  const requirementId = String(requirement?.id || '')
  const mapped = (Array.isArray(evidenceItems) ? evidenceItems : []).filter((item) =>
    item?.status === 'ACTIVE'
      && (Array.isArray(item.mappings) ? item.mappings : []).some((mapping) => String(mapping?.requirementId || '') === requirementId)
  )
  if (!mapped.length) return ''
  return `<section class="panel requirement-mapped-evidence">
    <div class="panel-heading"><div><span class="eyebrow">CURRENT EVIDENCE</span><h2>Mapped evidence</h2><p>These active files are mapped to this requirement. Evidence stays Not Reviewed until an evidence review is completed.</p></div></div>
    <div class="requirement-mapped-evidence-list">
      ${mapped.map((item) => `<article class="requirement-mapped-evidence-item">
        <div><span class="eyebrow">${escapeHtml(evidenceCategoryLabel(item.category))}</span><h3>${escapeHtml(item.title || item.originalFilename || 'Evidence')}</h3><p>${escapeHtml(item.originalFilename || '')}${item.version ? ` · Version ${escapeHtml(String(item.version))}` : ''}</p></div>
        <div class="requirement-mapped-evidence-actions"><span class="evidence-review-pill">${escapeHtml(evidenceReviewLabel(item))}</span><button type="button" class="secondary-button" data-action="evidence-download" data-evidence-id="${escapeHtml(item.id || '')}">${icon('download',16)} Download</button></div>
      </article>`).join('')}
    </div>
  </section>`
}
function requirementSide(requirement) {
  return `<aside class="requirement-detail-side">
    <section class="panel requirement-detail-block"><h3>Classification</h3><p>${escapeHtml(requirement.classificationLabel || requirement.classification || '')}</p></section>
    <section class="panel requirement-detail-block"><h3>Controlled sources</h3>${sourceLinks(requirement.sourceUrls)}</section>
  </aside>`
}

function notApplicableView(requirement, plainEnglish) {
  const reason = requirement.applicabilityReason || requirement.statusReason || 'Based on the current Practice Information, this requirement does not apply.'
  return `<section class="panel requirement-applicability-note">
      <div><span class="eyebrow">APPLICABILITY</span><h3>Not Applicable</h3><p>${escapeHtml(reason)}</p></div>
      <button type="button" class="secondary-button" data-accreditation-view="practice-information">Change this information</button>
    </section>
    <div class="requirement-detail-grid">
      <section class="panel requirement-detail-main">
        <div class="requirement-reason"><span class="label">Why this requirement is not applicable</span><p>${escapeHtml(reason)}</p></div>
        ${plainEnglish ? `<section class="requirement-detail-block"><h3>What this requirement means</h3><p>${escapeHtml(plainEnglish)}</p></section>` : ''}
      </section>
      ${requirementSide(requirement)}
    </div>`
}

export function renderRequirementDetail(requirement = {}, { evidenceItems = [] } = {}) {
  const questions = Array.isArray(requirement.questions) ? requirement.questions : []
  const evidence = Array.isArray(requirement.evidenceCriteria) ? requirement.evidenceCriteria : []
  const plainEnglish = isTemplatePlainEnglish(requirement.plainEnglishRequirement) ? '' : requirement.plainEnglishRequirement
  const primaryQuestion = questions[0] || null
  const notApplicable = String(requirement.applicabilityStatus || '').toUpperCase() === 'NOT_APPLICABLE'
  const statusMarkup = notApplicable
    ? '<span class="applicability-pill not-applicable">Not Applicable</span>'
    : `<span class="readiness-pill ${readinessClass(requirement.readinessStatus)}">${escapeHtml(readinessLabel(requirement.readinessStatus))}</span><span>${escapeHtml(verificationLabel(requirement.verificationStatus))}</span>`

  return `<section class="requirement-detail">
    <button type="button" class="conversation-back requirement-back" data-accreditation-view="requirements">${icon('chevron-left',15)} Back to requirements</button>
    <section class="panel requirement-detail-hero">
      <div><span class="eyebrow">${escapeHtml(requirement.criterion || 'RACGP 5TH EDITION')}</span><h2>${escapeHtml(requirement.indicator || requirement.id || '')} · ${escapeHtml(requirement.criterionDescription || '')}</h2>${plainEnglish ? `<p>${escapeHtml(plainEnglish)}</p>` : ''}</div>
      <div class="requirement-detail-status">${statusMarkup}</div>
    </section>

    ${notApplicable ? notApplicableView(requirement, plainEnglish) : `
      ${readinessQuestion(requirement, primaryQuestion)}

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

        ${requirementSide(requirement)}
      </div>

      ${questions.length > 1 ? `<section class="panel requirement-config-section">
        <div class="panel-heading"><div><h2>Additional readiness questions</h2><p>Answer the facts you know today. Unknown answers stay visible as not checked.</p></div></div>
        ${questions.slice(1).map((question) => `<article class="requirement-question-config"><strong>${escapeHtml(question.wording || '')}</strong><p>${escapeHtml((question.answerOptions || []).join(' · '))}</p></article>`).join('')}
      </section>` : ''}

      ${mappedEvidenceSection(requirement, evidenceItems)}

      <section class="panel requirement-config-section">
        <div class="panel-heading"><div><h2>Possible evidence</h2><p>Examples of evidence that may help. You can demonstrate this requirement in other ways where appropriate.</p></div><button type="button" class="primary-button" data-action="evidence-upload-for-requirement" data-requirement-id="${escapeHtml(requirement.id || '')}">${icon('upload',16)} Upload evidence</button></div>
        ${evidence.length ? evidence.map((item) => `<article class="requirement-evidence-config"><strong>${escapeHtml(item.evidenceType || '')}</strong><p>${escapeHtml(item.evidenceRule || '')}</p></article>`).join('') : '<div class="accreditation-empty-state"><p>No evidence examples are configured for this requirement.</p></div>'}
      </section>
    `}
  </section>`
}
