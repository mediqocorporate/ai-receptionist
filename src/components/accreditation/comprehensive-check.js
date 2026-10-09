import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'

function userFacingWhy(value = '') {
  const text = String(value || '').trim()
  if (/explain the specific missing fact or evidence that prevents assessment/i.test(text)) return ''
  return text
}

export function renderComprehensiveCheck(check = {}, { submitting = false } = {}) {
  const coverage = check.coverage || { answered: 0, total: 0, percent: 0 }
  const question = check.nextQuestion || null
  const aspirationalCount = Number(check.aspirationalCount || 0)
  const classificationPendingCount = Number(check.classificationPendingCount || 0)

  if (!question) {
    return `<section class="comprehensive-check-layout">
      <article class="panel readiness-check-card readiness-check-complete">
        <span class="future-icon">${icon('check',22)}</span>
        <div><span class="eyebrow">COMPREHENSIVE CHECK</span><h2>Configured mandatory questions reviewed</h2><p>You have answered the currently configured questions for verified mandatory requirements that are not marked Not Applicable. Continue reviewing evidence and requirements before relying on readiness.</p></div>
        <div class="comprehensive-context"><span>${aspirationalCount} aspirational requirements are tracked separately.</span><span>${classificationPendingCount} requirements still need classification validation and are not treated as mandatory.</span></div>
        <button class="secondary-button" type="button" data-accreditation-view="requirements">Review requirements</button>
      </article>
    </section>`
  }

  const options = Array.isArray(question.answerOptions) ? question.answerOptions : []
  return `<section class="comprehensive-check-layout">
    <article class="panel readiness-check-card">
      <div class="readiness-check-progress">
        <div><span class="eyebrow">COMPREHENSIVE CHECK · VERIFIED MANDATORY</span><strong>${Number(coverage.answered || 0)} of ${Number(coverage.total || 0)}</strong></div>
        <span>${Number(coverage.percent || 0)}% covered</span>
      </div>
      <div class="coverage-bar"><span style="width:${Math.max(0, Math.min(100, Number(coverage.percent || 0)))}%"></span></div>
      <div class="readiness-question">
        <span class="question-priority">${escapeHtml(question.indicator || question.priority || 'RACGP 5')}</span>
        <h2>${escapeHtml(question.wording || '')}</h2>
        ${userFacingWhy(question.whyWeAsk) ? `<p>${escapeHtml(userFacingWhy(question.whyWeAsk))}</p>` : ''}
      </div>
      <div class="readiness-answer-grid">
        ${options.map((option) => `<button type="button" class="readiness-answer-option" data-accreditation-answer data-check-mode="comprehensive" data-question-id="${escapeHtml(question.id)}" data-answer-label="${escapeHtml(option)}" ${submitting ? 'disabled' : ''}><span>${escapeHtml(option)}</span>${icon('chevron',16)}</button>`).join('')}
      </div>
      <p class="accreditation-safety-note">Choose the factual answer you know today. “I'm not sure” keeps the requirement in a state that needs more information.</p>
    </article>
    <aside class="panel readiness-check-help">
      <span class="eyebrow">ASSESSMENT SCOPE</span>
      <h3>Mandatory, aspirational and unverified are kept separate</h3>
      <p>This check currently includes ${Number(coverage.total || 0)} verified mandatory requirements with configured questions. ${aspirationalCount} aspirational requirements are separate, and ${classificationPendingCount} requirements still need classification validation before MediQo treats them as mandatory or aspirational.</p>
    </aside>
  </section>`
}
