import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'

function selected(value, expected) {
  return String(value ?? '') === String(expected) ? 'selected' : ''
}

export function renderAccreditationSetup({
  values = {},
  agencies = [],
  submitting = false,
  error = '',
  complete = false,
} = {}) {
  if (complete) {
    return `<section class="panel accreditation-setup-complete">
      <span class="future-icon">${icon('check',22)}</span>
      <div><span class="eyebrow">WORKSPACE READY</span><h2>Your accreditation workspace is set up</h2><p>Start with the Quick Readiness Check, or return to the overview to review the practice information MediQo is using.</p></div>
      <div class="dialog-actions"><button class="secondary-button" type="button" data-accreditation-view="practice-information">Review Practice Information</button><button class="primary-button" type="button" data-accreditation-view="check">Start Quick Readiness Check</button></div>
    </section>`
  }

  const agencyList = Array.isArray(agencies) ? agencies : []
  return `<section class="accreditation-setup-layout">
    <article class="panel accreditation-setup-card">
      <div class="dialog-heading"><span class="eyebrow">ACCREDITATION SETUP</span><h2>Set up your accreditation workspace</h2><p>Tell MediQo only what you know today. Unknown details can stay unknown and be added later.</p></div>
      ${error ? `<div class="form-alert">${icon('alert',15)} ${escapeHtml(error)}</div>` : ''}
      <form data-accreditation-setup-form class="wizard-form">
        <label class="field"><span>Where are you in your accreditation journey?</span><select name="journeyStatus">
          <option value="NOT_SURE" ${selected(values.journeyStatus, 'NOT_SURE')}>I'm not sure yet</option>
          <option value="FIRST_ACCREDITATION" ${selected(values.journeyStatus, 'FIRST_ACCREDITATION')}>Preparing for first accreditation</option>
          <option value="REACCREDITATION" ${selected(values.journeyStatus, 'REACCREDITATION')}>Preparing for reaccreditation</option>
          <option value="ASSESSMENT_BOOKED" ${selected(values.journeyStatus, 'ASSESSMENT_BOOKED')}>Assessment is booked</option>
        </select></label>

        <label class="field"><span>Is your next assessment date scheduled?</span><select name="assessmentScheduled">
          <option value="UNKNOWN" ${selected(values.assessmentScheduled, 'UNKNOWN')}>I'm not sure / not scheduled yet</option>
          <option value="YES" ${selected(values.assessmentScheduled, 'YES')}>Yes</option>
          <option value="NO" ${selected(values.assessmentScheduled, 'NO')}>No</option>
        </select></label>

        <label class="field"><span>Assessment date, if known</span><input type="date" name="targetAssessmentDate" value="${escapeHtml(values.targetAssessmentDate || '')}" /><small>Leave this blank if the date is not known. MediQo will not invent a countdown.</small></label>

        <label class="field"><span>Accrediting agency</span><select name="accreditingAgencyId">
          <option value="">I'm not sure yet</option>
          ${agencyList.map((agency) => `<option value="${escapeHtml(agency.id)}" ${selected(values.accreditingAgencyId, agency.id)}>${escapeHtml(agency.name)}</option>`).join('')}
        </select><small>Only client-approved agencies configured in MediQo appear here.</small></label>

        <label class="field"><span>Services or practice context MediQo should know</span><textarea name="services" placeholder="e.g. general practice services, procedures, nursing services or other relevant context">${escapeHtml(values.services || '')}</textarea></label>
        <label class="field"><span>Anything else useful for accreditation setup?</span><textarea name="notes" placeholder="Add any practice-specific context you want MediQo to remember for accreditation.">${escapeHtml(values.notes || '')}</textarea></label>

        <div class="dialog-actions"><button class="secondary-button" type="button" data-action="accreditation-home">Cancel</button><button class="primary-button" type="submit" ${submitting ? 'disabled' : ''}>${submitting ? 'Saving…' : `Set up workspace ${icon('chevron',15)}`}</button></div>
      </form>
    </article>
    <aside class="panel readiness-check-help"><span class="eyebrow">KNOWN ≠ ASSUMED</span><h3>You can leave details unknown</h3><p>MediQo uses the facts you provide and keeps uncertainty visible. An unanswered setup question will not be turned into a practice fact.</p></aside>
  </section>`
}
