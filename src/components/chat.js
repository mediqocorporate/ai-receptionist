import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

const suggestions = [
  { icon: 'graduation-cap', tone: 'purple', title: 'Prepare for accreditation', prompt: 'What do I need to do for our next RACGP accreditation?' },
  { icon: 'clipboard', tone: 'blue', title: 'Check a requirement', prompt: 'What mandatory training does my team need?' },
  { icon: 'users', tone: 'coral', title: 'Handle a situation', prompt: 'A patient has made a complaint. What should I do next?' },
  { icon: 'file-plus', tone: 'green', title: 'Create something', prompt: 'Create an onboarding checklist for a new receptionist.' },
  { icon: 'circle-dollar', tone: 'pink', title: 'Medicare and billing', prompt: 'What MBS item number should we use for a standard GP consultation?' },
  { icon: 'sparkle', tone: 'gold', title: 'See what other practices do', prompt: 'How are other practices handling DNA fees?' },
]

export function renderComposer({ value = '', loading = false, compact = false } = {}) {
  const safe = escapeHtml(value)
  return `<form class="chat-composer ${compact ? 'compact' : ''}" data-chat-form>
    <div class="composer-main">
      <textarea name="question" maxlength="500" rows="1" aria-label="Ask MediQo a question" placeholder="${compact ? 'Ask another question about your practice...' : 'Ask MediQo anything about running your practice...'}" ${loading ? 'disabled' : ''}>${safe}</textarea>
      <button class="send-button" type="submit" aria-label="Send question" ${loading ? 'disabled' : ''}>${loading ? '<span class="spinner"></span>' : icon('send', 20)}</button>
    </div>
    <div class="composer-foot"><button type="button" class="attach-button" aria-label="Attach file" data-action="attach-file">${icon('paperclip', 19)}</button><input class="attachment-input" type="file" hidden aria-hidden="true" tabindex="-1" /><span class="attachment-name" aria-live="polite"></span><span class="char-count">${safe.length}/500</span></div>
  </form>`
}

export function renderAskHome() {
  return `<section class="assistant-home">
    <div class="assistant-hero">
      <div class="sparkle-mark">${icon('sparkle', 36)}</div>
      <h1>Your AI Assistant for Practice Management</h1>
      <p>Get instant, accurate answers to your questions about accreditation, Medicare, HR,<br class="desktop-only"> compliance and day-to-day practice operations — with trusted sources and citations.</p>
    </div>
    <div class="suggestion-grid">
      ${suggestions.map((item) => `<button class="suggestion-card" type="button" data-suggestion="${escapeHtml(item.prompt)}">
        <span class="suggestion-icon ${item.tone}">${icon(item.icon, 24)}</span>
        <span class="suggestion-copy"><strong>${escapeHtml(item.title)}</strong><span>“${escapeHtml(item.prompt)}”</span></span>
        <span class="suggestion-arrow">${icon('chevron', 18)}</span>
      </button>`).join('')}
    </div>
    <div class="home-composer-wrap">${renderComposer()}</div>
  </section>`
}

function renderSection(section, index) {
  const body = section.body ? `<p>${escapeHtml(section.body)}</p>` : ''
  const items = section.items ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''
  return `<section class="answer-section"><div class="section-number">${index + 1}</div><div><h3>${escapeHtml(section.title)}</h3>${body}${items}</div></section>`
}

function renderSources(answer) {
  return `<div class="source-block">
    <div class="source-title">${icon('file-text', 17)}<strong>Sources</strong></div>
    <ol>${answer.sources.map((source) => `<li><span class="source-index"></span><span>${escapeHtml(source.title)} <small>— ${escapeHtml(source.publisher)}</small></span></li>`).join('')}</ol>
    <div class="prototype-note">${escapeHtml(answer.note || '')}</div>
  </div>`
}

function renderRisk(answer) {
  if (!answer.risk) return ''
  return `<div class="risk-callout">${icon('alert', 18)}<div><strong>Practice-specific guidance may be needed</strong><span>This topic can require professional or authority guidance. Confirm current official guidance or professional advice before acting where appropriate.</span></div></div>`
}

export function renderAnswerView(answer, question, { saved = false, loading = false } = {}) {
  return `<section class="conversation-page">
    <div class="conversation-grid">
      <div class="conversation-main">
        <div class="user-message-row">
          <div class="user-bubble"><span>${escapeHtml(question)}</span><small>Today, 10:24 AM</small></div>
          <span class="message-avatar user-icon">${icon('users', 18)}</span>
        </div>
        <div class="assistant-message-row">
          <span class="assistant-orb">${icon('sparkle', 23)}</span>
          <article class="assistant-answer">
            <div class="answer-topline"></div>
            <p class="answer-intro">${escapeHtml(answer.intro)}</p>
            ${renderRisk(answer)}
            <div class="answer-sections">${answer.sections.map(renderSection).join('')}</div>
            ${answer.cta ? `<button class="internal-cta" type="button" data-nav="${answer.cta.path}">${escapeHtml(answer.cta.label)} ${icon('chevron', 16)}</button>` : ''}
            ${renderSources(answer)}
            <div class="answer-actions"><span>Was this helpful?</span><button type="button" aria-label="Helpful" data-action="answer-helpful">${icon('thumbsUp', 16)}</button><button type="button" aria-label="Not helpful" data-action="answer-not-helpful">${icon('thumbsDown', 16)}</button><button type="button" data-action="save-answer" data-answer-id="${answer.id}" class="save-answer ${saved ? 'saved' : ''}">${icon('bookmark', 16)} ${saved ? 'Saved' : 'Save'}</button></div>
          </article>
        </div>
        ${loading ? '<div class="assistant-loading"><span class="assistant-orb">'+icon('sparkle',20)+'</span><div class="typing"><i></i><i></i><i></i></div></div>' : ''}
      </div>
      <aside class="related-rail" aria-label="Related information">
        <section class="rail-card"><div class="rail-heading">${icon('search', 20)}<strong>Related questions</strong></div>${answer.relatedQuestions.map((q) => `<button type="button" class="related-question" data-related-question="${escapeHtml(q)}"><span>${escapeHtml(q)}</span>${icon('chevron', 16)}</button>`).join('')}</section>
        <section class="rail-card"><div class="rail-heading">${icon('notebook', 20)}<strong>Related resources</strong></div>${answer.relatedResources.map((r) => `<button type="button" class="related-resource" ${r.internalPath ? `data-nav="${r.internalPath}"` : 'data-action="resource-unavailable"'}><span><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.publisher)}</small></span>${r.internalPath ? icon('chevron',15) : icon('external',15)}</button>`).join('')}</section>
      </aside>
    </div>
    <div class="conversation-composer-wrap">${renderComposer({ compact: true, loading })}</div>
  </section>`
}

export function renderFallbackView(question, suggestions) {
  return `<section class="conversation-page"><div class="conversation-grid"><div class="conversation-main">
    <div class="user-message-row"><div class="user-bubble"><span>${escapeHtml(question)}</span><small>Today, 10:24 AM</small></div><span class="message-avatar user-icon">${icon('users',18)}</span></div>
    <div class="assistant-message-row"><span class="assistant-orb">${icon('sparkle',23)}</span><article class="assistant-answer fallback-answer"><h2>Try one of the prepared practice-manager questions</h2><p>I can help with the prepared practice-manager topics below right now. Choose one to see a structured answer, sources and next actions.</p><div class="fallback-suggestions">${suggestions.map((q) => `<button type="button" data-related-question="${escapeHtml(q)}">${escapeHtml(q)} ${icon('chevron',15)}</button>`).join('')}</div></article></div>
  </div><aside class="related-rail"><section class="rail-card"><div class="rail-heading">${icon('sparkle',20)}<strong>Available topics</strong></div><p class="rail-copy">Accreditation, HR, staff training, privacy, document creation, Medicare and regulatory alerts.</p></section></aside></div><div class="conversation-composer-wrap">${renderComposer({compact:true})}</div></section>`
}
