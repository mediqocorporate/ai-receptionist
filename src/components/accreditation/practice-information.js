import { escapeHtml } from '../../lib/html.js'

function valueText(fact = {}) {
  if (fact.value === null || fact.value === undefined || fact.value === '') return 'Not provided'
  return String(fact.value)
}

export function renderPracticeInformation(practiceInformation = {}, { loading = false } = {}) {
  if (loading && !Array.isArray(practiceInformation?.facts)) {
    return '<section class="panel accreditation-loading-state"><div><h2>Loading Practice Information</h2><p>MediQo is loading the facts used to personalise this accreditation workspace.</p></div></section>'
  }

  const facts = Array.isArray(practiceInformation?.facts) ? practiceInformation.facts : []
  return `<section class="practice-information-view">
    <div class="practice-information-heading"><span class="eyebrow">PRACTICE INFORMATION</span><h2>Facts MediQo is relying on</h2><p>Review the information used to personalise applicability and readiness. Unknown information stays visible instead of being assumed.</p></div>
    <div class="practice-fact-grid">${facts.length ? facts.map((fact) => `<article class="panel practice-fact-card"><span>${escapeHtml(fact.label || fact.key || 'Practice fact')}</span><strong>${escapeHtml(valueText(fact))}</strong><small>Source: ${escapeHtml(fact.provenance || 'Not provided')}</small></article>`).join('') : '<article class="panel empty-inline"><div><strong>No practice facts loaded yet</strong><span>Complete accreditation setup to add known practice context.</span></div></article>'}</div>
  </section>`
}
