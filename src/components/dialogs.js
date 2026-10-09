import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

export const AUSTRALIAN_LOCATIONS = ['NSW', 'VIC', 'QLD', 'ACT', 'WA', 'SA', 'NT', 'TAS']

function fieldError(name, errors) {
  return errors?.[name] ? `<small class="field-error" id="${name}-error">${escapeHtml(errors[name])}</small>` : ''
}

function locationOptions(checked = [], name = 'locations') {
  return AUSTRALIAN_LOCATIONS.map((loc)=>`<label><input type="checkbox" name="${name}" value="${loc}" ${checked.includes(loc)?'checked':''}/><span>${loc}</span></label>`).join('')
}

export function renderSignupDialog({ errors = {}, values = {}, submitting = false, serverError = '' } = {}) {
  const checked = Array.isArray(values.locations) ? values.locations : []
  return `<div class="dialog-backdrop" data-dialog="signup">
    <section class="dialog signup-dialog" role="dialog" aria-modal="true" aria-labelledby="signup-dialog-title">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',22)}</button>
      <div class="signup-benefits">
        <span class="modal-kicker">${icon('lock',16)} CREATE A FREE ACCOUNT</span>
        <h2 id="signup-dialog-title">Don't lose your answers. Keep using <span>MediQo</span> for free.</h2>
        <p>Create a free account to save this conversation, keep asking questions and access tools built for Australian general practice.</p>
        <div class="benefit-list expanded-benefits">
          <div><span class="benefit-icon">${icon('check',18)}</span><p><strong>Save your questions and answers</strong><small>Keep useful advice on hand and pick up where you left off.</small></p></div>
          <div><span class="benefit-icon">${icon('check',18)}</span><p><strong>Get answers personalised to your practice</strong><small>Based on your practice type, location and services.</small></p></div>
          <div><span class="benefit-icon">${icon('check',18)}</span><p><strong>Ask as many questions as you need</strong><small>Get help with accreditation, Medicare, HR, compliance and day-to-day practice management.</small></p></div>
          <div><span class="benefit-icon">${icon('check',18)}</span><p><strong>Access practice templates and tools</strong><small>Create policies, checklists, reports and other useful practice documents.</small></p></div>
          <div><span class="benefit-icon">${icon('check',18)}</span><p><strong>Stay across important changes</strong><small>Get relevant updates across RACGP, Medicare, Fair Work and more.</small></p></div>
        </div>
      </div>
      <div class="signup-form-side">
        <div class="dialog-heading"><h2>Your practice details</h2><p>It only takes a minute. Your current conversation will be saved.</p></div>
        ${serverError ? `<div class="form-alert">${icon('alert',16)} ${escapeHtml(serverError)}</div>` : ''}
        <form data-signup-form novalidate>
          <label class="field"><span>Clinic Name</span><input autofocus name="clinicName" value="${escapeHtml(values.clinicName||'')}" placeholder="e.g. Riverside Medical Centre" aria-describedby="clinicName-error"/>${fieldError('clinicName',errors)}</label>
          <div class="field-row"><label class="field"><span>First Name</span><input name="firstName" value="${escapeHtml(values.firstName||'')}" placeholder="e.g. Sarah" aria-describedby="firstName-error"/>${fieldError('firstName',errors)}</label><label class="field"><span>Last Name</span><input name="lastName" value="${escapeHtml(values.lastName||'')}" placeholder="e.g. Jones" aria-describedby="lastName-error"/>${fieldError('lastName',errors)}</label></div>
          <label class="field"><span>Job Title</span><input name="jobTitle" value="${escapeHtml(values.jobTitle||'')}" placeholder="e.g. Practice Manager" aria-describedby="jobTitle-error"/>${fieldError('jobTitle',errors)}</label>
          <label class="field"><span>Work Email</span><input type="email" name="email" value="${escapeHtml(values.email||'')}" placeholder="e.g. sarah@yourclinic.com.au" aria-describedby="email-help email-error"/><small id="email-help">Use your work email for your MediQo account.</small>${fieldError('email',errors)}</label>
          <label class="field"><span>Password</span><div class="password-wrap"><input type="password" name="password" value="${escapeHtml(values.password||'')}" placeholder="Create a password" aria-describedby="password-error"/><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password">${icon('eye',18)}</button></div>${fieldError('password',errors)}</label>
          <fieldset class="field location-field"><legend>Locations <small>(select all that apply)</small></legend><div class="location-options">${locationOptions(checked)}</div>${fieldError('locations',errors)}</fieldset>
          <button class="gradient-submit" type="submit" ${submitting?'disabled':''}>${submitting?'<span class="spinner"></span> Creating account…':`Keep using MediQo for free ${icon('chevron',18)}`}</button>
          <p class="terms">Already have an account? <button type="button" class="text-button" data-action="sign-in">Sign in</button></p>\n          <p class="terms">By creating an account, you agree to our <a href="#" data-action="terms">Terms of Service</a> and <a href="#" data-action="privacy">Privacy Policy</a>.</p>
        </form>
      </div>
    </section>
  </div>`
}


export function renderLoginDialog({ values = {}, submitting = false, serverError = '' } = {}) {
  return `<div class="dialog-backdrop" data-dialog="login"><section class="dialog compact-dialog login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>
    <div class="dialog-icon purple">${icon('lock',24)}</div><h2 id="login-title">Sign in to MediQo</h2><p>Continue with your MediQo Practice Manager account.</p>
    ${serverError ? `<div class="form-alert">${icon('alert',16)} ${escapeHtml(serverError)}</div>` : ''}
    <form data-login-form novalidate>
      <label class="field"><span>Work Email</span><input autofocus type="email" name="email" value="${escapeHtml(values.email||'')}" placeholder="you@practice.com.au" required /></label>
      <label class="field"><span>Password</span><div class="password-wrap"><input type="password" name="password" placeholder="Your password" required /><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password">${icon('eye',18)}</button></div></label>
      <button class="primary-button" type="submit" ${submitting?'disabled':''}>${submitting?'Signing in…':'Sign in'}</button>
    </form>
  </section></div>`
}

export function renderTrialRequestDialog() {
  return `<div class="dialog-backdrop" data-dialog="trial-request"><section class="dialog hubspot-trial-dialog" role="dialog" aria-modal="true" aria-labelledby="trial-request-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>
    <div class="dialog-heading"><span class="eyebrow">MEDIQO PRODUCT ENQUIRY</span><h2 id="trial-request-title">Request a free trial</h2><p>Tell us a little about your practice and the MediQo team will follow up with trial access and next steps.</p></div>
    <div class="hubspot-form-shell">
      <div class="hs-form-frame" data-region="ap1" data-form-id="07bbbe65-ab6e-4ecb-b433-87975a9a36c8" data-portal-id="442479260"></div>
    </div>
  </section></div>`
}

export function renderFeatureRequestDialog({ values = {}, submitting = false, serverError = '' } = {}) {
  return `<div class="dialog-backdrop" data-dialog="feature-request"><section class="dialog compact-dialog feature-request-dialog" role="dialog" aria-modal="true" aria-labelledby="feature-request-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>
    <div class="dialog-icon purple">${icon('sparkle',24)}</div><h2 id="feature-request-title">Request a feature</h2><p>Have an idea that would make MediQo more useful for your practice? Send it to the team.</p>
    ${serverError ? `<div class="form-alert">${icon('alert',16)} ${escapeHtml(serverError)}</div>` : ''}
    <form data-feature-request-form class="feature-request-form">
      <label class="field"><span>Name</span><input autofocus name="name" value="${escapeHtml(values.name||'')}" placeholder="Your name" required /></label>
      <label class="field"><span>Email</span><input type="email" name="email" value="${escapeHtml(values.email||'')}" placeholder="you@practice.com.au" required /></label>
      <label class="field"><span>Practice</span><input name="practice" value="${escapeHtml(values.practice||'')}" placeholder="Practice name" /></label>
      <label class="field"><span>Feature suggestion</span><textarea name="suggestion" placeholder="What would you like MediQo to do?" required>${escapeHtml(values.suggestion||'')}</textarea></label>
      <label class="field"><span>Why would this help?</span><textarea name="reason" placeholder="Tell us how this would help your team.">${escapeHtml(values.reason||'')}</textarea></label>
      <button class="primary-button" type="submit" ${submitting?'disabled':''}>${submitting?'Sending…':`Send suggestion ${icon('chevron',16)}`}</button>
    </form>
  </section></div>`
}

const PMS_VENDORS = ['Nookal', 'Best Practice', 'Cliniko', 'Halaxy']

export function renderPmsDialog({ step = 1, vendor = '', siteId = '', pairKey = '' } = {}) {
  const safeStep = [1, 2, 3].includes(Number(step)) ? Number(step) : 1
  const selectedVendor = PMS_VENDORS.includes(vendor) ? vendor : ''

  if (safeStep === 1) {
    return `<div class="dialog-backdrop" data-dialog="pms"><section class="dialog pms-dialog" role="dialog" aria-modal="true" aria-labelledby="pms-title">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>
      <div class="dialog-heading"><span class="eyebrow">CONNECT YOUR PMS</span><h2 id="pms-title">Choose your practice management system</h2><p>Select the system your practice uses to continue setup.</p></div>
      <div class="pms-vendor-grid">${PMS_VENDORS.map((name) => `<article class="pms-vendor-card"><strong>${escapeHtml(name)}</strong><button class="secondary-button" type="button" data-action="pms-select-vendor" data-pms-vendor="${escapeHtml(name)}">Connect</button></article>`).join('')}</div>
      <div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">Close</button></div>
    </section></div>`
  }

  if (safeStep === 2) {
    return `<div class="dialog-backdrop" data-dialog="pms"><section class="dialog pms-dialog" role="dialog" aria-modal="true" aria-labelledby="pms-title">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>
      <div class="dialog-heading"><span class="eyebrow">CONNECT ${escapeHtml(selectedVendor || 'YOUR PMS').toUpperCase()}</span><h2 id="pms-title">Enter your connection details</h2><p>Add the details provided for your practice management system.</p></div>
      <form class="pms-connection-form">
        <label class="field"><span>Site ID</span><input name="siteId" value="${escapeHtml(siteId)}" autocomplete="off" /></label>
        <label class="field"><span>Pair key</span><input name="pairKey" value="${escapeHtml(pairKey)}" autocomplete="off" /></label>
        <div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">Close</button><button class="primary-button" type="button" data-action="pms-continue">Continue</button></div>
      </form>
    </section></div>`
  }

  return `<div class="dialog-backdrop" data-dialog="pms"><section class="dialog pms-dialog pms-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="pms-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>
    <div class="dialog-heading"><span class="eyebrow">FINAL STEP</span><h2 id="pms-title">Complete your setup</h2><p>Select a date and time from the options below, and we'll complete your setup with you, enable any new features and show you how to get the most out of MediQo.</p></div>
    <div class="hubspot-meeting-shell pms-meeting-shell"><div class="meetings-iframe-container" data-src="https://meetings-ap1.hubspot.com/matt-nott/practice-manager-demo?embed=true"></div></div>
    <div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">Close</button></div>
  </section></div>`
}

export function renderHelpDialog() {
  return `<div class="dialog-backdrop" data-dialog="help"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button><div class="dialog-icon purple">${icon('help',24)}</div><h2 id="help-title">Using MediQo</h2><p>Ask a practice-management question in plain English, open Accreditation Assistant to work through evidence and actions, or use Policy Library to create a practice document.</p><div class="shortcut-list"><span><kbd>Enter</kbd> Send a question</span><span><kbd>Shift</kbd> + <kbd>Enter</kbd> New line</span><span><kbd>Esc</kbd> Close a dialog</span></div><button class="primary-button" type="button" data-action="close-dialog">Got it</button></section></div>`
}

export function renderEvidenceDialog() {
  return `<div class="dialog-backdrop" data-dialog="evidence"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button><div class="dialog-icon purple">${icon('sparkle',24)}</div><h2 id="evidence-title">Evidence assessment workflow</h2><ol class="numbered-flow"><li>Upload or link evidence</li><li>MediQo identifies the mapped requirement and standards edition</li><li>AI proposes gaps, expiry dates and follow-up actions</li><li>A practice manager reviews and assigns the next action</li></ol><button class="primary-button" type="button" data-action="close-dialog">Close</button></section></div>`
}
