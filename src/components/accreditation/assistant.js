import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'

const SUGGESTIONS = [
  'What should we prioritise next for accreditation?',
  'Which confirmed gaps need attention first?',
  'Which evidence reviews still need follow-up?',
  'What outstanding actions should I focus on this week?',
]

function renderComposer({ loading = false } = {}) {
  return `<form class="chat-composer compact" data-accreditation-assistant-form>
    <div class="composer-main">
      <textarea name="question" maxlength="500" rows="1" aria-label="Ask Accreditation Assistant" placeholder="Ask about your accreditation readiness, gaps, evidence or next actions..." ${loading ? 'disabled' : ''}></textarea>
      <button class="send-button" type="submit" aria-label="Send accreditation question" ${loading ? 'disabled' : ''}>${loading ? '<span class="spinner"></span>' : icon('send', 20)}</button>
    </div>
    <div class="composer-foot"><span class="accreditation-assistant-context-note">Uses your saved accreditation data and approved sources.</span><span class="char-count">0/500</span></div>
  </form>`
}

function renderSections(answer = {}) {
  return `<div class="answer-sections">${(answer.sections || []).map((section, index) => `<section class="answer-section">
    <div class="section-number">${index + 1}</div>
    <div><h3>${escapeHtml(section.title || '')}</h3>${section.body ? `<p>${escapeHtml(section.body)}</p>` : ''}${Array.isArray(section.items) && section.items.length ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</div>
  </section>`).join('')}</div>`
}

function renderSources(answer = {}) {
  if (!Array.isArray(answer.sources) || !answer.sources.length) return ''
  return `<div class="source-block">
    <div class="source-title">${icon('file-text', 17)}<strong>Sources</strong></div>
    <ol>${answer.sources.map((source) => `<li><span class="source-index"></span><span><a href="${escapeHtml(source.url || '')}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || '')} <small>— ${escapeHtml(source.publisher || '')}</small></a></span></li>`).join('')}</ol>
  </div>`
}

function renderRisk(answer = {}) {
  if (!answer.risk) return ''
  return `<div class="risk-callout">${icon('alert', 18)}<div><strong>Confirm current official guidance where needed</strong><span>MediQo does not determine accreditation outcomes. Verify material decisions against the linked official source or your accrediting body.</span></div></div>`
}

function renderAnswer(answer = {}) {
  return `<div class="assistant-message-row">
    <span class="assistant-orb">${icon('sparkle', 23)}</span>
    <article class="assistant-answer answer-reveal">
      <p class="answer-intro">${escapeHtml(answer.intro || '')}</p>
      ${renderRisk(answer)}
      ${renderSections(answer)}
      ${renderSources(answer)}
    </article>
  </div>`
}

function renderTurn(turn = {}) {
  return `<div class="conversation-turn">
    <div class="user-message-row"><div class="user-bubble"><span>${escapeHtml(turn.question || '')}</span></div><span class="message-avatar user-icon">${icon('users',18)}</span></div>
    ${turn.answer ? renderAnswer(turn.answer) : ''}
  </div>`
}

function renderPending(question = '') {
  if (!question) return ''
  return `<div class="conversation-turn pending-turn">
    <div class="user-message-row"><div class="user-bubble"><span>${escapeHtml(question)}</span></div><span class="message-avatar user-icon">${icon('users',18)}</span></div>
    <div class="assistant-loading"><span class="assistant-orb">${icon('sparkle',20)}</span><div class="thinking-status" role="status" aria-live="polite"><div class="thinking-label"><strong>MediQo is checking your accreditation workspace</strong><div class="typing" aria-hidden="true"><i></i><i></i><i></i></div></div><span>Using saved readiness data and approved sources…</span></div></div>
  </div>`
}

function renderError(question = '', message = '') {
  if (!question || !message) return ''
  return `<div class="conversation-turn failed-turn">
    <div class="user-message-row"><div class="user-bubble"><span>${escapeHtml(question)}</span></div><span class="message-avatar user-icon">${icon('users',18)}</span></div>
    <div class="assistant-message-row"><span class="assistant-orb">${icon('alert',20)}</span><article class="assistant-answer"><h3 class="assistant-error-title">We couldn’t prepare that accreditation answer</h3><p>${escapeHtml(message)}</p></article></div>
  </div>`
}

function renderRelatedRail(answer) {
  if (!answer) return ''
  const questions = Array.isArray(answer.relatedQuestions) ? answer.relatedQuestions : []
  const resources = Array.isArray(answer.relatedResources) ? answer.relatedResources : []
  return `<aside class="related-rail" aria-label="Related accreditation information">
    <section class="rail-card"><div class="rail-heading">${icon('search',20)}<strong>Related questions</strong></div>${questions.length ? questions.map((question) => `<button type="button" class="related-question" data-accreditation-related-question="${escapeHtml(question)}"><span>${escapeHtml(question)}</span>${icon('chevron',16)}</button>`).join('') : '<p class="rail-copy">Ask another question about your current readiness.</p>'}</section>
    <section class="rail-card"><div class="rail-heading">${icon('notebook',20)}<strong>Related resources</strong></div>${resources.length ? resources.map((resource) => `<a class="related-resource" href="${escapeHtml(resource.url || '')}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(resource.title || '')}</strong><small>${escapeHtml(resource.publisher || '')}</small></span>${icon('external',15)}</a>`).join('') : '<p class="rail-copy">No approved resource was needed for this answer.</p>'}</section>
  </aside>`
}

export function renderAccreditationAssistant(state = {}, { practiceName = 'Your practice' } = {}) {
  const turns = Array.isArray(state.turns) ? state.turns : []
  const latestAnswer = [...turns].reverse().find((turn) => turn?.answer)?.answer || null
  const hasConversation = turns.length || state.loading || (state.error && state.failedQuestion)

  if (!hasConversation) {
    return `<section class="accreditation-assistant-workspace accreditation-assistant-empty">
      <section class="panel accreditation-assistant-intro">
        <div class="accreditation-assistant-intro-copy">
          <h2>What would you like to check?</h2>
          <p>Ask about ${escapeHtml(practiceName)}’s requirements, gaps, evidence or outstanding actions.</p>
        </div>
        <div class="accreditation-assistant-empty-composer">${renderComposer()}</div>
        <div class="accreditation-assistant-suggestions" aria-label="Suggested accreditation questions">
          <span>Try asking</span>
          <div>${SUGGESTIONS.map((question) => `<button type="button" class="secondary-button" data-accreditation-assistant-suggestion="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join('')}</div>
        </div>
      </section>
    </section>`
  }

  return `<section class="accreditation-assistant-workspace">
    <div class="accreditation-assistant-grid">
      <div class="accreditation-assistant-main">${turns.map(renderTurn).join('')}${state.loading ? renderPending(state.pendingQuestion || '') : ''}${!state.loading ? renderError(state.failedQuestion || '', state.error || '') : ''}</div>
      ${renderRelatedRail(latestAnswer)}
    </div>
    <div class="accreditation-assistant-composer-wrap">${renderComposer({ loading: Boolean(state.loading) })}</div>
  </section>`
}
