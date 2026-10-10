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

const REVIEW_OPTIONS = [
  ['SUFFICIENT_FOR_REVIEW', 'Sufficient for review'],
  ['INCOMPLETE', 'Incomplete'],
  ['OUTDATED', 'Outdated'],
  ['CONFLICTING', 'Conflicting'],
  ['MORE_INFORMATION_REQUIRED', 'More information required'],
]

function reviewStatusLabel(value) {
  const labels = {
    ...Object.fromEntries(REVIEW_OPTIONS),
    NOT_REVIEWED: 'Not Reviewed',
  }
  return labels[value] || 'Not Reviewed'
}

export function evidenceCategoryLabel(value) {
  return CATEGORIES.find(([id]) => id === value)?.[1] || 'Other'
}

export function evidenceReviewLabel(item) {
  const assessments = Array.isArray(item.assessments) ? item.assessments : []
  if (!assessments.length) return 'Not Reviewed'
  const statuses = [...new Set(assessments.map((assessment) => assessment.reviewStatus).filter(Boolean))]
  if (statuses.length !== 1) return 'Mixed review states'
  return reviewStatusLabel(statuses[0])
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

function activeAssessment(item, requirementId) {
  const assessments = Array.isArray(item.assessments) ? item.assessments : []
  return assessments.find((assessment) => assessment.requirementId === requirementId) || null
}

function reviewControls(item, requirements) {
  const mappings = Array.isArray(item.mappings) ? item.mappings : []
  if (!mappings.length) return ''
  const byId = new Map(requirements.map((requirement) => [requirement.id, requirement]))

  return `<section class="evidence-review-controls">
    <div class="evidence-review-heading">
      <div><span class="label">Practice review</span><h4>Review against a requirement</h4></div>
      <p>Record what your practice has checked. A review record does not automatically mark the RACGP requirement ready.</p>
    </div>
    <div class="evidence-review-list">
      ${mappings.map((mapping) => {
        const requirement = byId.get(mapping.requirementId)
        const assessment = activeAssessment(item, mapping.requirementId)
        const label = requirement?.indicator || mapping.requirementId
        return `<form class="evidence-review-form" data-accreditation-evidence-review-form data-evidence-id="${escapeHtml(item.id)}">
          <input type="hidden" name="requirementId" value="${escapeHtml(mapping.requirementId)}" />
          <div class="evidence-review-form-heading">
            <strong>${escapeHtml(label)}</strong>
            <span class="evidence-review-pill">${escapeHtml(reviewStatusLabel(assessment?.reviewStatus))}</span>
          </div>
          <label><span>Review status</span>
            <select name="reviewStatus" required>
              <option value="">Choose a review status</option>
              ${REVIEW_OPTIONS.map(([value, text]) => `<option value="${value}" ${assessment?.reviewStatus === value ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}
            </select>
          </label>
          <label class="evidence-review-reason"><span>Why?</span>
            <textarea name="reason" rows="2" maxlength="1500" required placeholder="Explain what you checked and why this status applies.">${escapeHtml(assessment?.reason || '')}</textarea>
          </label>
          <label class="evidence-review-action"><span>Recommended next action <small>(optional)</small></span>
            <textarea name="recommendedAction" rows="2" maxlength="1500" placeholder="What should the practice do next?">${escapeHtml(assessment?.recommendedAction || '')}</textarea>
          </label>
          <div class="evidence-review-submit">
            <button type="submit" class="secondary-button">Save review</button>
          </div>
        </form>`
      }).join('')}
    </div>
  </section>`
}

function evidenceCard(item, requirements, prefillRequirementId) {
  const active = item.status === 'ACTIVE'
  return `<article class="panel evidence-item-card" data-evidence-card="${escapeHtml(item.id)}">
    <div class="evidence-item-heading">
      <div>
        <span class="eyebrow">${escapeHtml(evidenceCategoryLabel(item.category))}</span>
        <h3>${escapeHtml(item.title || item.originalFilename || 'Evidence')}</h3>
        <p>${escapeHtml(item.originalFilename || '')}${item.version ? ` · Version ${escapeHtml(String(item.version))}` : ''}</p>
      </div>
      <div class="evidence-item-statuses">
        <span class="evidence-review-pill">${escapeHtml(evidenceReviewLabel(item))}</span>
        ${item.status === 'SUPERSEDED' ? '<span class="evidence-status-pill">Superseded</span>' : ''}
      </div>
    </div>
    <div class="evidence-item-grid">
      <div><span class="label">Mapped requirements</span>${mappingChips(item, requirements)}</div>
      <div><span class="label">Review state</span><p>${escapeHtml(evidenceReviewLabel(item))}. Evidence review is recorded separately from requirement readiness.</p></div>
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
    ${active ? reviewControls(item, requirements) : ''}
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
  const selectedFileCount = Array.isArray(state.selectedFiles) ? state.selectedFiles.length : 0
  const selectedCategory = String(state.selectedCategory || 'POLICY_PROCEDURE')
  const progress = state.uploadProgress && typeof state.uploadProgress === 'object' ? state.uploadProgress : null
  const progressPercent = Math.max(0, Math.min(100, Number(progress?.percent || 0)))
  const progressCurrent = Math.max(0, Number(progress?.currentFileIndex || 0))
  const progressTotal = Math.max(0, Number(progress?.totalFiles || selectedFileCount || 0))
  const progressFilename = String(progress?.currentFilename || '')
  const hasLoaded = Boolean(state.loaded)
  const prefill = eligibleRequirements.find((item) => item.id === prefillRequirementId)

  return `<section class="accreditation-evidence-library">
    <section class="panel evidence-upload-panel">
      <div class="panel-heading evidence-library-heading">
        <div><span class="eyebrow">EVIDENCE</span><h2>Evidence Library</h2><p>Securely upload and organise evidence against RACGP requirements. Uploading a file does not by itself make a requirement ready.</p></div>
        ${prefill ? `<span class="evidence-target-pill">Uploading for ${escapeHtml(prefill.indicator || prefill.id)}</span>` : ''}
      </div>
      <form data-accreditation-evidence-upload-form class="evidence-upload-form">
        <div class="evidence-upload-row">
          <label class="evidence-category-field"><span>Evidence category</span><select name="category">${CATEGORIES.map(([value,label]) => `<option value="${value}" ${value === selectedCategory ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
          <label class="evidence-file-picker">
            <span class="evidence-file-icon">${icon('upload',20)}</span>
            <span><strong>Choose evidence files</strong><small>PDF, DOCX, XLSX, CSV, JPG, JPEG or PNG · 25 MB per file · up to 50 files per batch</small></span>
            <input type="file" name="evidenceFiles" multiple accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png" />
          </label>
        </div>
        <div class="evidence-upload-footer">
          <span class="muted-copy" data-evidence-selected-summary>${selectedFileCount ? `${selectedFileCount} file${selectedFileCount === 1 ? '': 's'} selected` : 'No files selected'}</span>
          <button type="submit" class="primary-button" ${state.uploading ? 'disabled' : ''}>${state.uploading ? 'Uploading…' : 'Upload selected files'}</button>
        </div>
        ${state.uploading ? `<div class="evidence-upload-progress" data-evidence-upload-progress>
          <div class="evidence-progress-copy">
            <strong data-evidence-progress-label>Uploading ${escapeHtml(progressFilename || 'evidence')}</strong>
            <span data-evidence-progress-percent>${progressPercent}%</span>
          </div>
          <div class="evidence-progress-track" role="progressbar" aria-label="Evidence upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}">
            <span class="evidence-progress-bar" data-evidence-progress-bar style="width:${progressPercent}%"></span>
          </div>
          <div class="evidence-progress-meta" data-evidence-progress-batch>${progressTotal > 1 && progressCurrent ? `${progressCurrent} of ${progressTotal} files` : 'Uploading securely to your Evidence Library'}</div>
        </div>` : ''}
      </form>
      <div class="accreditation-inline-error" data-evidence-upload-error ${state.error ? '' : 'hidden'}>${escapeHtml(state.error || '')}</div>
    </section>

    <section class="evidence-library-list">
      <div class="evidence-list-heading"><div><h2>Your evidence</h2><p>Map each file to the requirements it supports. Review status stays explicit until evidence intelligence or a human review is completed.</p></div><span>${items.length} ${items.length === 1 ? 'file' : 'files'}</span></div>
      ${(!hasLoaded || state.loading) && !items.length ? '<section class="panel accreditation-loading-state"><p>Loading evidence…</p></section>' : ''}
      ${hasLoaded && !state.loading && !items.length ? '<section class="panel accreditation-empty-state"><h3>No evidence uploaded yet</h3><p>Upload existing policies, registers, certificates, audits and other supporting files to start building your Evidence Library.</p></section>' : ''}
      ${items.map((item) => evidenceCard(item, eligibleRequirements, prefillRequirementId)).join('')}
    </section>
  </section>`
}
