import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

function fieldError(name, errors) {
  return errors?.[name] ? `<small class="field-error" id="${name}-error">${escapeHtml(errors[name])}</small>` : ''
}

export function renderSignupDialog({ errors = {}, values = {}, trial = false, submitting = false, serverError = '' } = {}) {
  const title = trial ? 'Start your MediQo free trial' : 'Create a free account to continue using MediQo'
  const rightTitle = trial ? 'Your practice details' : 'Your practice details'
  const checked = Array.isArray(values.locations) ? values.locations : []
  return `<div class="dialog-backdrop" data-dialog="signup">
    <section class="dialog signup-dialog" role="dialog" aria-modal="true" aria-labelledby="signup-dialog-title">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',22)}</button>
      <div class="signup-benefits">
        <span class="modal-kicker">${icon('lock',16)} ${trial ? 'START A FREE TRIAL' : 'CREATE A FREE ACCOUNT'}</span>
        <h2 id="signup-dialog-title">${title.replace('MediQo','<span>MediQo</span>')}</h2>
        <p>MediQo is for practice admin teams, not the general public. Continue with personalised answers, templates and tools for your practice.</p>
        <div class="benefit-list">
          <div><span class="benefit-icon">${icon('message-circle',22)}</span><p><strong>Personalised for your practice</strong><small>Get relevant answers based on your practice type, state and services.</small></p></div>
          <div><span class="benefit-icon">${icon('shield-check',22)}</span><p><strong>Built for Australian general practice</strong><small>Designed around trusted sources including RACGP, Medicare and Fair Work.</small></p></div>
          <div><span class="benefit-icon">${icon('file-text',22)}</span><p><strong>Access templates and tools</strong><small>Create policies, checklists, reports and more.</small></p></div>
        </div>
      </div>
      <div class="signup-form-side">
        <div class="dialog-heading"><h2>${rightTitle}</h2><p>It only takes a minute. Your current conversation will be saved.</p></div>
        ${serverError ? `<div class="form-alert">${icon('alert',16)} ${escapeHtml(serverError)}</div>` : ''}
        <form data-signup-form novalidate>
          <label class="field"><span>Clinic Name</span><input autofocus name="clinicName" value="${escapeHtml(values.clinicName||'')}" placeholder="e.g. Riverside Medical Centre" aria-describedby="clinicName-error"/>${fieldError('clinicName',errors)}</label>
          <div class="field-row"><label class="field"><span>First Name</span><input name="firstName" value="${escapeHtml(values.firstName||'')}" placeholder="e.g. Sarah" aria-describedby="firstName-error"/>${fieldError('firstName',errors)}</label><label class="field"><span>Last Name</span><input name="lastName" value="${escapeHtml(values.lastName||'')}" placeholder="e.g. Jones" aria-describedby="lastName-error"/>${fieldError('lastName',errors)}</label></div>
          <label class="field"><span>Job Title</span><input name="jobTitle" value="${escapeHtml(values.jobTitle||'')}" placeholder="e.g. Practice Manager" aria-describedby="jobTitle-error"/>${fieldError('jobTitle',errors)}</label>
          <label class="field"><span>Work Email</span><input type="email" name="email" value="${escapeHtml(values.email||'')}" placeholder="e.g. sarah@yourclinic.com.au" aria-describedby="email-help email-error"/><small id="email-help">Use your work email for your MediQo account.</small>${fieldError('email',errors)}</label>
          <label class="field"><span>Password</span><div class="password-wrap"><input type="password" name="password" value="${escapeHtml(values.password||'')}" placeholder="Create a password" aria-describedby="password-error"/><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password">${icon('eye',18)}</button></div>${fieldError('password',errors)}</label>
          <fieldset class="field location-field"><legend>Locations <small>(select all that apply)</small></legend><div class="location-options">${['NSW','VIC','QLD','Other'].map((loc)=>`<label><input type="checkbox" name="locations" value="${loc}" ${checked.includes(loc)?'checked':''}/><span>${loc}</span></label>`).join('')}</div>${fieldError('locations',errors)}</fieldset>
          <button class="gradient-submit" type="submit" ${submitting?'disabled':''}>${submitting?'<span class="spinner"></span> Creating account…':`${trial?'Start free trial':'Create account'} ${icon('chevron',18)}`}</button>
          <p class="terms">By creating an account, you agree to our <a href="#" data-action="terms">Terms of Service</a> and <a href="#" data-action="privacy">Privacy Policy</a>.</p>
        </form>
      </div>
    </section>
  </div>`
}

export function renderPmsDialog() {
  return `<div class="dialog-backdrop" data-dialog="pms"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="pms-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button><div class="dialog-icon purple">${icon('refresh',24)}</div><h2 id="pms-title">Connect your practice management system</h2><p>Choose the practice management system your clinic uses. MediQo can use this connection to personalise workflows and reduce double handling.</p><div class="pms-list"><span>Best Practice</span><span>Cliniko</span><span>Halaxy</span><span>Other PMS</span></div><button class="primary-button" type="button" data-action="pms-demo-confirm">Continue</button></section></div>`
}

export function renderHelpDialog() {
  return `<div class="dialog-backdrop" data-dialog="help"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button><div class="dialog-icon purple">${icon('help',24)}</div><h2 id="help-title">Using MediQo</h2><p>Ask a practice-management question in plain English, open Accreditation Assistant to work through evidence and actions, or use Policy Library to create a practice document.</p><div class="shortcut-list"><span><kbd>Enter</kbd> Send a question</span><span><kbd>Shift</kbd> + <kbd>Enter</kbd> New line</span><span><kbd>Esc</kbd> Close a dialog</span></div><button class="primary-button" type="button" data-action="close-dialog">Got it</button></section></div>`
}

export function renderEvidenceDialog() {
  return `<div class="dialog-backdrop" data-dialog="evidence"><section class="dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button><div class="dialog-icon purple">${icon('sparkle',24)}</div><h2 id="evidence-title">Evidence assessment workflow</h2><ol class="numbered-flow"><li>Upload or link evidence</li><li>MediQo identifies the mapped requirement and standards edition</li><li>AI proposes gaps, expiry dates and follow-up actions</li><li>A practice manager reviews and assigns the next action</li></ol><button class="primary-button" type="button" data-action="close-dialog">Close</button></section></div>`
}
