import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'
import { renderAccreditationOverview } from './accreditation/overview.js'
import { renderReadinessCheck } from './accreditation/readiness-check.js'
import { renderRequirementsView } from './accreditation/requirements.js'
import { renderRequirementDetail } from './accreditation/requirement-detail.js'
import { renderAccreditationExplore } from './accreditation/explore.js'
import { renderAccreditationSetup } from './accreditation/setup.js'
import { renderPracticeInformation } from './accreditation/practice-information.js'
import { renderComprehensiveCheck } from './accreditation/comprehensive-check.js'

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

function renderFirstVisit(practiceName) {
  return `<section class="accreditation-first-visit">
    <article class="panel accreditation-first-visit-card">
      <span class="future-icon">${icon('shield-check',24)}</span>
      <div><span class="eyebrow">RACGP 5TH EDITION</span><h2>Let's get your practice ready for accreditation.</h2><p>MediQo can guide ${escapeHtml(practiceName)} through readiness questions, requirements, evidence and next actions while keeping unknown information visible.</p></div>
      <div class="accreditation-first-actions"><button class="primary-button" type="button" data-action="accreditation-start-setup">Set up my accreditation</button><button class="secondary-button" type="button" data-action="accreditation-explore">Explore Accreditation Assistant</button></div>
    </article>
    <aside class="panel readiness-check-help"><span class="eyebrow">NO SELF-ASSESSMENT NEEDED</span><h3>Answer facts, not “Does this meet the standard?”</h3><p>MediQo asks practical questions, checks available evidence and separates what is known from what still needs confirmation.</p></aside>
  </section>`
}

export function renderAccreditationPage(state = {}, options = {}) {
  const practiceName = options.practiceName || 'Your practice'
  const signedIn = options.signedIn !== false
  const currentView = state.view || 'overview'
  const overview = state.overview || null
  const setupRequired = Boolean(overview?.setupRequired && !overview?.cycle)
  const hasWorkspace = Boolean(overview?.cycle)

  let body
  if (!signedIn) body = renderSignIn()
  else if (currentView === 'explore') body = renderAccreditationExplore({ step: state.exploreStep || 0 })
  else if (currentView === 'setup') body = renderAccreditationSetup({
    step: state.setup?.step || 1,
    values: state.setup?.values || {},
    agencies: state.practiceInformation?.agencies || overview?.agencies || [],
    submitting: Boolean(state.setup?.submitting),
    error: state.setup?.error || '',
    complete: Boolean(state.setup?.complete),
  })
  else if (state.loading && !overview) body = renderLoading()
  else if (state.error && !overview) body = renderError(state.error)
  else if (!overview) body = renderLoading()
  else if (setupRequired) body = renderFirstVisit(practiceName)
  else if (currentView === 'check') body = renderReadinessCheck(overview, { submitting: state.submitting })
  else if (currentView === 'comprehensive' && !state.comprehensive) body = renderLoading()
  else if (currentView === 'comprehensive') body = renderComprehensiveCheck(state.comprehensive, { submitting: state.submitting })
  else if (currentView === 'requirements') body = renderRequirementsView(overview.requirements || [], { filter: state.filter || 'ALL' })
  else if (currentView === 'requirement' && state.requirement) body = renderRequirementDetail(state.requirement)
  else if (currentView === 'practice-information') body = renderPracticeInformation(state.practiceInformation || {}, { loading: state.practiceInformationLoading })
  else body = renderAccreditationOverview(overview, { practiceName })

  const showBack = signedIn && ['check','comprehensive','requirements','requirement','practice-information','setup'].includes(currentView)
  return `<section class="feature-page accreditation-page accreditation-live-workspace">
    ${showBack ? `<div class="accreditation-page-back"><button type="button" class="conversation-back" data-action="accreditation-home">${icon('chevron',16)}<span>Back to Accreditation Overview</span></button></div>` : ''}
    <div class="page-heading-row">
      <div><span class="eyebrow">ACCREDITATION ASSISTANT · RACGP 5TH EDITION</span><h1>Accreditation readiness</h1><p>Understand what is known, what still needs checking, and the next practical action for ${escapeHtml(practiceName)}.</p></div>
      ${hasWorkspace ? `<button type="button" class="secondary-button" data-action="ask-accreditation">${icon('message-circle',17)} Ask Accreditation Assistant</button>` : ''}
    </div>
    ${signedIn && hasWorkspace ? `<nav class="accreditation-tabs" aria-label="Accreditation workspace">
      ${navButton('overview', currentView, 'Overview')}
      ${navButton('check', currentView, 'Quick Check')}
      ${navButton('comprehensive', currentView, 'Comprehensive Check')}
      ${navButton('requirements', currentView, 'Requirements')}
      ${navButton('practice-information', currentView, 'Practice Information')}
    </nav>` : ''}
    ${state.error && overview ? `<div class="accreditation-inline-error">${icon('alert',15)} ${escapeHtml(state.error)}</div>` : ''}
    ${body}
  </section>`
}
