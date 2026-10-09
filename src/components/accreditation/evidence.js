import { escapeHtml } from '../../lib/html.js'
import { icon } from '../icons.js'

const CATEGORIES = [
  ['POLICY_PROCEDURE', 'Policy / procedure'],
  ['REGISTER', 'Register'],
  ['TRAINING_CREDENTIAL', 'Training / credential'],
  ['CERTIFICATE', 'Certificate'],
  ['AUDIT_REPORT', 'Audit / report'],
  ['MEETING_RECORD', 'Meeting record'],
  ['EQUIPMENT_MAINTENANCE', 'Equipment / maintenance'],
  ['PATIENT_FEEDBACK', 'Patient feedback'],
  ['OTHER', 'Other'],
]

function categoryLabel(value) {
  return CATEGORIES.find(([id]) => id === value)?.[1] || 'Other'
}

function reviewLabel(item) {
  const active = Array.isArray(item.assessments) ? item.assessments[0] : null
  if (!active) return 'Not Reviewed'
  const labels = {
    SUFFICIENT_FOR_REVIEW: 'Sufficient for review',
    INCOMPLETE: 'Incomplete',
    OUTDATED: 'Outdated',
    CONFLICTING: 'Conflicting',
    MORE_INFORMATION_REQUIRED: 'More information required',
    NOT_REVIEWED: 'Not Reviewed',
  }
  return labels[active.reviewStatus] || 'Not Reviewed'
}

function mappingChips(item, requirements) {
  const byId = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const mappings = Array.isArray(item.mappings) ? item.mappings : []
  if (!mappings.length) return '<span class="muted-copy">Not mapped yet</span>'
  return `<div class="evidence-mapping-chips">${mappings.map((mapping) => {
    const requirement = byId.get(mapping.requirementId)
    const label = requirement?.indicator || mapping.requirementId
    return `<span class="evidence-map-chip">${escapeHtml(label)}</span>`
  }).join('')}</div>`
}

function requirementOptions(requirements, selected = '') {
  return requirements.map((requirement) => `<option value="${escapeHtml(requirement.id)}" ${requirement.id === selected ? 'selected' : ''}>${escapeHtml(requirement.indicator || requirement.id)} — ${escapeHtml(requirement.criterionDescription || '')}</option>`).join('')
}

function evidenceCard(item, requirements, prefillRequirementId) {
  const active = item.status === 'ACTIVE'
  return `<article class="panel evidence-item-card" data-evidence-card="${escapeHtml(item.id)}">
    <div class="evidence-item-heading">
      <div>
        <span class="eyebrow">${escapeHtml(categoryLabel(item.category))}</span>
        <h3>${escapeHtml(item.title || item.originalFilename || 'Evidence')}</h3>
        <p>${escapeHtml(item.originalFilename || '')}${item.version ? ` · Version ${escapeHtml(String(item.version))}` : ''}</p>
      </div>
      <div class="evidence-item-statuses">
        <span class="evidence-review-pill">${escapeHtml(reviewLabel(item))}</span>
        ${item.status === 'SUPERSEDED' ? '<span class="evidence-status-pill">Superseded</span>' : ''}
      </div>
    </div>
    <div class="evidence-item-grid">
      <div><span class="label">Mapped requirements</span>${mappingChips(item, requirements)}</div>
      <div><span class="label">Review state</span><p>Evidence is stored, but MediQo does not infer readiness until it has been reviewed against a requirement.</p></div>
    </div>
    ${active ? `<div class="evidence-map-controls">
      <label><span>Map to requirement</span>
        <select data-evidence-requirement>
          <option value="">Choose a requirement</option>
          ${requirementOptions(requirements, prefillRequirementId)}
        </select>
      </label>
      <button type="button" class="secondary-button" data-action="evidence-link" data-evidence-id="${escapeHtml(item.id)}">Map evidence</button>
    </div>` : ''}
    <div class="evidence-item-actions">
      <button type="button" class="secondary-button" data-action="evidence-download" data-evidence-id="${escapeHtml(item.id)}">${icon('download',16)} Download</button>
      ${active ? `<button type="button" class="text-button evidence-supersede" data-action="evidence-supersede" data-evidence-id="${escapeHtml(item.id)}">Mark superseded</button>` : ''}
    </div>
  </article>`
}

export function renderAccreditationEvidence(state = {}, { requirements = [] } = {}) {
  const items = Array.isArray(state.items) ? state.items : []
  const eligibleRequirements = (Array.isArray(requirements) ? requirements : []).filter((item) => item.applicabilityStatus !== 'NOT_APPLICABLE')
  const prefillRequirementId = String(state.prefillRequirementId || '')
  const prefill = eligibleRequirements.find((item) => item.id === prefillRequirementId)

  return `<section class="accreditation-evidence-library">
    <section class="panel evidence-upload-panel">
      <div class="panel-heading evidence-library-heading">
        <div><span class="eyebrow">EVIDENCE</span><h2>Evidence Library</h2><p>Securely upload and organise evidence against RACGP requirements. Uploading a file does not by itself make a requirement ready.</p></div>
        ${prefill ? `<span class="evidence-target-pill">Uploading for ${escapeHtml(prefill.indicator || prefill.id)}</span>` : ''}
      </div>
      <form data-accreditation-evidence-upload-form class="evidence-upload-form">
        <div class="evidence-upload-row">
          <label class="evidence-category-field"><span>Evidence category</span><select name="category">${CATEGORIES.map(([value,label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('')}</select></label>
          <label class="evidence-file-picker">
            <span class="evidence-file-icon">${icon('upload',20)}</span>
            <span><strong>Choose evidence files</strong><small>PDF, DOCX, XLSX, CSV, JPG, JPEG or PNG · 25 MB per file · up to 50 files per batch</small></span>
            <input type="file" name="evidenceFiles" multiple accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png" />
          </label>
        </div>
        <div class="evidence-upload-footer">
          <span class="muted-copy" data-evidence-selected-summary>No files selected</span>
          <button type="submit" class="primary-button" ${state.uploading ? 'disabled' : ''}>${state.uploading ? 'Uploading…' : 'Upload selected files'}</button>
        </div>
      </form>
      ${state.error ? `<div class="accreditation-inline-error">${escapeHtml(state.error)}</div>` : ''}
    </section>

    <section class="evidence-library-list">
      <div class="evidence-list-heading"><div><h2>Your evidence</h2><p>Map each file to the requirements it supports. Review status stays explicit until evidence intelligence or a human review is completed.</p></div><span>${items.length} ${items.length === 1 ? 'file' : 'files'}</span></div>
      ${state.loading && !items.length ? '<section class="panel accreditation-loading-state"><p>Loading evidence…</p></section>' : ''}
      ${!state.loading && !items.length ? '<section class="panel accreditation-empty-state"><h3>No evidence uploaded yet</h3><p>Upload existing policies, registers, certificates, audits and other supporting files to start building your Evidence Library.</p></section>' : ''}
      ${items.map((item) => evidenceCard(item, eligibleRequirements, prefillRequirementId)).join('')}
    </section>
  </section>`
}
