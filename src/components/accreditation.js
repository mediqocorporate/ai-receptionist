import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'
import { renderAccreditationOverview } from './accreditation/overview.js'
import { renderReadinessCheck } from './accreditation/readiness-check.js'
import { renderRequirementsView } from './accreditation/requirements.js'
import { renderRequirementDetail } from './accreditation/requirement-detail.js'

function navButton(view, current, label) {
  return `<button type="button" class="accreditation-tab ${view === current ? 'active' : ''}" data-accreditation-view="${view}">${escapeHtml(label)}</button>`
}

function renderLoading() {
  return `<section class="panel accreditation-loading-state"><span class="assistant-orb">${icon('sparkle',20)}</span><div><h2>Loading accreditation workspace</h2><p>MediQo is loading the current RACGP 5th Edition cycle and saved practice progress.</p></div><div class="typing" aria-hidden="true"><i></i><i></i><i></i></div></section>`
}

function renderError(message) {
  return `<section class="panel accreditation-error-state"><span class="future-icon">${icon('alert',20)}</span><div><h2>Accreditation workspace is unavailable</h2><p>${escapeHtml(message || 'Please try again.')}</p></div><button class="secondary-button" type="button" data-action="retry-accreditation">Retry</button></section>`
}

function renderSignIn() {
  return `<section class="panel accreditation-signin-state"><span class="future-icon">${icon('shield-check',22)}</span><div><span class="eyebrow">ACCREDITATION ASSISTANT</span><h2>Sign in to work on practice readiness</h2><p>Accreditation answers, evidence status and requirement assessments are saved to your practice workspace.</p></div><button class="primary-button" type="button" data-action="sign-in">Sign in</button></section>`
}

export function renderAccreditationPage(state = {}, options = {}) {
  const practiceName = options.practiceName || 'Your practice'
  const signedIn = options.signedIn !== false
  const currentView = state.view || 'overview'
  const overview = state.overview || null

  let body
  if (!signedIn) body = renderSignIn()
  else if (state.loading && !overview) body = renderLoading()
  else if (state.error && !overview) body = renderError(state.error)
  else if (!overview) body = renderLoading()
  else if (currentView === 'check') body = renderReadinessCheck(overview, { submitting: state.submitting })
  else if (currentView === 'requirements') body = renderRequirementsView(overview.requirements || [], { filter: state.filter || 'ALL' })
  else if (currentView === 'requirement' && state.requirement) body = renderRequirementDetail(state.requirement)
  else body = renderAccreditationOverview(overview, { practiceName })

  return `<section class="feature-page accreditation-page accreditation-live-workspace">
    <div class="page-heading-row">
      <div><span class="eyebrow">ACCREDITATION ASSISTANT · RACGP 5TH EDITION</span><h1>Accreditation readiness</h1><p>Understand what is known, what still needs checking, and the next practical action for ${escapeHtml(practiceName)}.</p></div>
      <button type="button" class="secondary-button" data-action="ask-accreditation">${icon('message-circle',17)} Ask Accreditation Assistant</button>
    </div>
    ${signedIn && overview ? `<nav class="accreditation-tabs" aria-label="Accreditation workspace">
      ${navButton('overview', currentView, 'Overview')}
      ${navButton('check', currentView, 'Readiness Check')}
      ${navButton('requirements', currentView, 'Requirements')}
    </nav>` : ''}
    ${state.error && overview ? `<div class="accreditation-inline-error">${icon('alert',15)} ${escapeHtml(state.error)}</div>` : ''}
    ${body}
  </section>`
}
