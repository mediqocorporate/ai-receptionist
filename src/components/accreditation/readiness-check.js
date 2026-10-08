import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'

export function renderReadinessCheck(overview = {}, { submitting = false } = {}) {
  const coverage = overview.coverage || { answered: 0, total: 0, percent: 0 }
  const question = overview.nextQuestion

  if (!question) {
    return `<section class="panel readiness-check-card readiness-check-complete">
      <span class="future-icon">${icon('check',22)}</span>
      <div><span class="eyebrow">QUICK READINESS CHECK</span><h2>Priority questions reviewed</h2><p>You have answered the currently available P1 questions. Review requirements and evidence next; answering questions alone does not establish accreditation readiness.</p></div>
      <button class="secondary-button" type="button" data-accreditation-view="requirements">Review requirements</button>
    </section>`
  }

  const answerOptions = Array.isArray(question.answerOptions) ? question.answerOptions : []
  return `<section class="readiness-check-layout">
    <article class="panel readiness-check-card">
      <div class="readiness-check-progress">
        <div><span class="eyebrow">P1 QUICK READINESS CHECK</span><strong>${Number(coverage.answered || 0)} of ${Number(coverage.total || 0)}</strong></div>
        <span>${Number(coverage.percent || 0)}% covered</span>
      </div>
      <div class="coverage-bar"><span style="width:${Math.max(0, Math.min(100, Number(coverage.percent || 0)))}%"></span></div>
      <div class="readiness-question">
        <span class="question-priority">${escapeHtml(question.priority || 'P1')}</span>
        <h2>${escapeHtml(question.wording || '')}</h2>
        ${question.whyWeAsk ? `<p>${escapeHtml(question.whyWeAsk)}</p>` : ''}
      </div>
      <div class="readiness-answer-grid">
        ${answerOptions.map((option) => `<button type="button" class="readiness-answer-option" data-accreditation-answer data-question-id="${escapeHtml(question.id)}" data-answer-label="${escapeHtml(option)}" ${submitting ? 'disabled' : ''}><span>${escapeHtml(option)}</span>${icon('chevron',16)}</button>`).join('')}
      </div>
      <p class="accreditation-safety-note">Choose what you know today. “I'm not sure” stays Not Checked — MediQo will not treat uncertainty as a failure.</p>
    </article>
    <aside class="panel readiness-check-help"><span class="eyebrow">WHY THIS WORKS</span><h3>MediQo asks for facts, not a self-assessment</h3><p>You do not need to decide whether the practice meets the standard. MediQo records the fact you provide and keeps verification separate from readiness.</p></aside>
  </section>`
}
