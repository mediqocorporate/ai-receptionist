import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'

const STATES = ['NSW', 'VIC', 'QLD', 'ACT', 'WA', 'SA', 'NT', 'TAS']
const YES_NO_UNKNOWN = [
  ['UNKNOWN', "I'm not sure"],
  ['YES', 'Yes'],
  ['NO', 'No'],
]

function selected(value, expected) {
  return String(value ?? '') === String(expected) ? 'selected' : ''
}

function value(values, key, fallback = '') {
  return values?.[key] ?? fallback
}

function optionList(options, current) {
  return options.map(([key, label]) => `<option value="${escapeHtml(key)}" ${selected(current, key)}>${escapeHtml(label)}</option>`).join('')
}

function countField(name, label, values) {
  return `<label class="field"><span>${escapeHtml(label)}</span><input type="number" min="0" step="1" name="${escapeHtml(name)}" value="${escapeHtml(value(values, name, ''))}" placeholder="Leave blank if unknown" /></label>`
}

function triState(name, label, values) {
  return `<label class="field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}">${optionList(YES_NO_UNKNOWN, value(values, name, 'UNKNOWN'))}</select></label>`
}

function progress(step) {
  const safe = Math.max(1, Math.min(4, Number(step) || 1))
  const labels = ['Accreditation journey', 'Next assessment', 'Accrediting agency', 'Practice information']
  return `<div class="setup-progress"><div><strong>${labels[safe - 1]}</strong></div><div class="coverage-bar"><span style="width:${safe * 25}%"></span></div></div>`
}

function actions(step, submitting) {
  const safe = Math.max(1, Math.min(4, Number(step) || 1))
  const back = safe === 1
    ? '<button class="secondary-button" type="button" data-action="accreditation-home">Cancel</button>'
    : '<button class="secondary-button" type="button" data-action="accreditation-setup-back">Back</button>'
  const next = submitting
    ? 'Saving…'
    : safe === 4
      ? `Finish setup ${icon('chevron', 15)}`
      : `Continue ${icon('chevron', 15)}`
  return `<div class="dialog-actions">${back}<button class="primary-button" type="submit" ${submitting ? 'disabled' : ''}>${next}</button></div>`
}

function setupChoices() {
  return `<section class="accreditation-start-choices">
    <div class="dialog-heading"><span class="eyebrow">WORKSPACE READY</span><h2>How would you like to get started?</h2><p>All three paths feed the same RACGP 5th Edition readiness workspace. You can move between them as your preparation progresses.</p></div>
    <div class="setup-choice-grid">
      <button class="panel setup-choice-card" type="button" data-accreditation-view="check"><span class="future-icon">${icon('check',20)}</span><strong>Quick readiness check</strong><p>Get an initial picture by reviewing the current high-priority questions.</p><span>Start Quick Check →</span></button>
      <button class="panel setup-choice-card" type="button" data-accreditation-view="comprehensive"><span class="future-icon">${icon('shield-check',20)}</span><strong>Comprehensive readiness check</strong><p>Work systematically through verified mandatory RACGP requirements.</p><span>Start Comprehensive Check →</span></button>
      <button class="panel setup-choice-card" type="button" data-accreditation-view="evidence"><span class="future-icon">${icon('upload',20)}</span><strong>Upload my accreditation documents</strong><p>Add existing accreditation files to the secure Evidence Library and map them to RACGP requirements.</p><span>Open Evidence Library →</span></button>
    </div>
    <button class="secondary-button" type="button" data-accreditation-view="practice-information">Review Practice Information</button>
  </section>`
}

export function renderAccreditationSetup({
  step = 1,
  values = {},
  agencies = [],
  submitting = false,
  error = '',
  complete = false,
} = {}) {
  if (complete) return setupChoices()

  const agencyList = Array.isArray(agencies) ? agencies : []
  const safeStep = Math.max(1, Math.min(4, Number(step) || 1))
  let fields = ''

  if (safeStep === 1) {
    fields = `<label class="field"><span>Where are you in your accreditation journey?</span><select name="journeyStatus">
      <option value="FIRST_ACCREDITATION" ${selected(value(values, 'journeyStatus'), 'FIRST_ACCREDITATION')}>Preparing for our first accreditation</option>
      <option value="REACCREDITATION" ${selected(value(values, 'journeyStatus'), 'REACCREDITATION')}>Preparing for reaccreditation</option>
      <option value="CURRENTLY_ACCREDITED" ${selected(value(values, 'journeyStatus'), 'CURRENTLY_ACCREDITED')}>Currently accredited and preparing for our next cycle</option>
      <option value="NOT_SURE" ${selected(value(values, 'journeyStatus', 'NOT_SURE'), 'NOT_SURE')}>Not sure</option>
    </select><small>Choose what you know today. You can change this later.</small></label>`
  } else if (safeStep === 2) {
    fields = `<label class="field"><span>Do you have your next accreditation assessment scheduled?</span><select name="assessmentScheduled">${optionList([['UNKNOWN','Not sure'],['YES','Yes'],['NO','Not yet']], value(values, 'assessmentScheduled', 'UNKNOWN'))}</select></label>
      <label class="field"><span>Assessment date, if known</span><input type="date" name="targetAssessmentDate" value="${escapeHtml(value(values, 'targetAssessmentDate', ''))}" /><small>Leave this blank unless a real assessment date is known. MediQo will only use a date you provide.</small></label>`
  } else if (safeStep === 3) {
    fields = `<label class="field"><span>Have you selected your accrediting agency?</span><select name="accreditingAgencyId">
      <option value="" ${selected(value(values, 'accreditingAgencyId', ''), '')}>Not yet / I'm not sure</option>
      ${agencyList.map((agency) => `<option value="${escapeHtml(agency.id)}" ${selected(value(values, 'accreditingAgencyId'), agency.id)}>${escapeHtml(agency.name)}</option>`).join('')}
    </select></label>`
  } else {
    fields = `<div class="setup-profile-grid">
      <label class="field"><span>State / territory</span><select name="stateOrTerritory"><option value="">Not provided</option>${STATES.map((state) => `<option value="${state}" ${selected(value(values, 'stateOrTerritory'), state)}>${state}</option>`).join('')}</select></label>
      <label class="field"><span>Practice type</span><input type="text" name="practiceType" value="${escapeHtml(value(values, 'practiceType', ''))}" placeholder="e.g. General practice" /></label>
      ${countField('locationsCount', 'Number of locations', values)}
      ${countField('gpCount', 'Number of GPs', values)}
      ${countField('nursingWorkforce', 'Nursing workforce', values)}
      ${countField('alliedHealth', 'Allied health workforce', values)}
      ${countField('adminWorkforce', 'Reception / admin workforce', values)}
    </div>
    <div class="setup-service-grid">
      ${triState('vaccinations', 'Vaccinations', values)}
      ${triState('procedures', 'Procedures', values)}
      ${triState('telehealth', 'Telehealth', values)}
      ${triState('pathologyCollection', 'Pathology collection', values)}
      ${triState('pointOfCareTesting', 'Point-of-care testing', values)}
      ${triState('vaccineStorage', 'Vaccine storage', values)}
    </div>
    <label class="field"><span>Services / practice context</span><textarea name="services" placeholder="Add other relevant services or context">${escapeHtml(value(values, 'services', ''))}</textarea></label>
    <label class="field"><span>Additional practice context</span><textarea name="notes" placeholder="Anything else MediQo should know for accreditation applicability">${escapeHtml(value(values, 'notes', ''))}</textarea></label>`
  }

  return `<section class="accreditation-setup-layout">
    <article class="panel accreditation-setup-card">
      ${progress(safeStep)}
      <div class="dialog-heading"><span class="eyebrow">ACCREDITATION SETUP</span><h2>Set up your accreditation workspace</h2><p>Tell MediQo only what you know. Unknown information stays unknown instead of being assumed.</p></div>
      ${error ? `<div class="form-alert">${icon('alert',15)} ${escapeHtml(error)}</div>` : ''}
      <form data-accreditation-setup-form data-setup-step="${safeStep}" class="wizard-form">${fields}${actions(safeStep, submitting)}</form>
    </article>
    <aside class="panel readiness-check-help"><span class="eyebrow">KNOWN ≠ ASSUMED</span><h3>It is safe to leave information unknown</h3><p>Skipped or unknown setup information remains visible as Not provided and can be completed later from Practice Information.</p></aside>
  </section>`
}
