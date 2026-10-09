import { escapeHtml } from '../../lib/html.js'

const STATES = ['NSW', 'VIC', 'QLD', 'ACT', 'WA', 'SA', 'NT', 'TAS']
const JOURNEYS = [
  ['FIRST_ACCREDITATION', 'Preparing for first accreditation'],
  ['REACCREDITATION', 'Preparing for reaccreditation'],
  ['CURRENTLY_ACCREDITED', 'Currently accredited and preparing for next cycle'],
  ['ASSESSMENT_BOOKED', 'Assessment booked'],
  ['NOT_SURE', 'Not sure'],
]
const TRI_STATE = [['UNKNOWN', "I'm not sure"], ['YES', 'Yes'], ['NO', 'No']]

function selected(value, expected) {
  return String(value ?? '') === String(expected) ? 'selected' : ''
}

function humanEnum(value) {
  const map = new Map([
    ...JOURNEYS,
    ['UNKNOWN', 'Not sure'],
    ['YES', 'Yes'],
    ['NO', 'No'],
  ])
  return map.get(String(value ?? '')) || String(value ?? '')
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return String(value || '')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function valueText(fact = {}) {
  if (fact.value === null || fact.value === undefined || fact.value === '') return 'Not provided'
  if (Array.isArray(fact.value)) return fact.value.length ? fact.value.join(', ') : 'Not provided'
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(fact.value))) return formatDate(fact.value)
  return humanEnum(fact.value)
}

function triState(name, label, values) {
  return `<label class="field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}">${TRI_STATE.map(([key, text]) => `<option value="${key}" ${selected(values?.[name] || 'UNKNOWN', key)}>${escapeHtml(text)}</option>`).join('')}</select></label>`
}

function countField(name, label, values) {
  return `<label class="field"><span>${escapeHtml(label)}</span><input type="number" min="0" step="1" name="${escapeHtml(name)}" value="${escapeHtml(values?.[name] ?? '')}" placeholder="Leave blank if unknown" /></label>`
}

function renderEditor(practiceInformation = {}, { submitting = false, error = '' } = {}) {
  const values = practiceInformation?.values || {}
  const agencies = Array.isArray(practiceInformation?.agencies) ? practiceInformation.agencies : []
  return `<section class="panel practice-information-editor">
    <div class="practice-information-heading"><div><span class="eyebrow">PRACTICE INFORMATION</span><h2>Edit practice information</h2><p>Update the facts MediQo uses for applicability and readiness. Leave anything you do not know blank or marked Not sure.</p></div></div>
    ${error ? `<div class="form-alert">${escapeHtml(error)}</div>` : ''}
    <form data-accreditation-practice-information-form class="wizard-form">
      <div class="setup-profile-grid">
        <label class="field"><span>Accreditation journey</span><select name="journeyStatus">${JOURNEYS.map(([key, label]) => `<option value="${key}" ${selected(values.journeyStatus || 'NOT_SURE', key)}>${escapeHtml(label)}</option>`).join('')}</select></label>
        <label class="field"><span>Next assessment scheduled?</span><select name="assessmentScheduled">${TRI_STATE.map(([key, label]) => `<option value="${key}" ${selected(values.assessmentScheduled || 'UNKNOWN', key)}>${escapeHtml(label)}</option>`).join('')}</select></label>
        <label class="field"><span>Assessment date, if known</span><input type="date" name="targetAssessmentDate" value="${escapeHtml(values.targetAssessmentDate || '')}" /></label>
        <label class="field"><span>Accrediting agency</span><select name="accreditingAgencyId"><option value="">Not yet / I'm not sure</option>${agencies.map((agency) => `<option value="${escapeHtml(agency.id)}" ${selected(values.accreditingAgencyId, agency.id)}>${escapeHtml(agency.name)}</option>`).join('')}</select></label>
        <label class="field"><span>State / territory</span><select name="stateOrTerritory"><option value="">Not provided</option>${STATES.map((state) => `<option value="${state}" ${selected(values.stateOrTerritory, state)}>${state}</option>`).join('')}</select></label>
        <label class="field"><span>Practice type</span><input type="text" name="practiceType" value="${escapeHtml(values.practiceType || '')}" placeholder="e.g. General practice" /></label>
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
      <label class="field"><span>Services / practice context</span><textarea name="services" placeholder="Add other relevant services or context">${escapeHtml(values.services || '')}</textarea></label>
      <label class="field"><span>Additional practice context</span><textarea name="notes" placeholder="Anything else MediQo should know for accreditation applicability">${escapeHtml(values.notes || '')}</textarea></label>
      <div class="dialog-actions"><button class="secondary-button" type="button" data-action="accreditation-cancel-practice-information-edit">Cancel</button><button class="primary-button" type="submit" ${submitting ? 'disabled' : ''}>${submitting ? 'Saving…' : 'Save & reassess'}</button></div>
    </form>
  </section>`
}

export function renderPracticeInformation(practiceInformation = {}, { loading = false, editing = false, submitting = false, error = '' } = {}) {
  if (loading && !Array.isArray(practiceInformation?.facts)) {
    return '<section class="panel accreditation-loading-state"><div><h2>Loading Practice Information</h2><p>MediQo is loading the facts used to personalise this accreditation workspace.</p></div></section>'
  }
  if (editing) return renderEditor(practiceInformation, { submitting, error })

  const facts = Array.isArray(practiceInformation?.facts) ? practiceInformation.facts : []
  return `<section class="practice-information-view">
    <div class="practice-information-heading"><div><span class="eyebrow">PRACTICE INFORMATION</span><h2>Facts MediQo is relying on</h2><p>Review the information used to personalise applicability and readiness. Unknown information stays visible instead of being assumed.</p></div><button class="secondary-button" type="button" data-action="accreditation-edit-practice-information">Edit Practice Information</button></div>
    <div class="practice-fact-grid">${facts.length ? facts.map((fact) => `<article class="panel practice-fact-card"><span>${escapeHtml(fact.label || fact.key || 'Practice fact')}</span><strong>${escapeHtml(valueText(fact))}</strong><small>Source: ${escapeHtml(fact.provenance || 'Not provided')}</small></article>`).join('') : '<article class="panel empty-inline"><div><strong>No practice facts loaded yet</strong><span>Complete accreditation setup to add known practice context.</span></div></article>'}</div>
  </section>`
}
