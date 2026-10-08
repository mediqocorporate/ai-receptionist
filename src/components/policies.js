import { policyCategories, policyTemplates } from '../data/policies.js'
import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

function formatSavedDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function renderSavedDocuments(savedDocuments = [], { loading = false, error = '' } = {}) {
  const documents = Array.isArray(savedDocuments) ? savedDocuments : []
  if (!documents.length && !loading && !error) return ''

  return `<section class="saved-policy-section">
    <div class="section-heading-row"><div><span class="eyebrow">YOUR PRACTICE</span><h2>Your documents</h2><p>Saved drafts and practice documents stay available in your Policy Library.</p></div></div>
    ${error ? `<div class="form-alert">${icon('alert',16)} ${escapeHtml(error)}</div>` : ''}
    ${loading ? '<div class="policy-loading">Loading your documents…</div>' : ''}
    ${documents.length ? `<div class="saved-document-grid">${documents.map((document) => `<article class="saved-document-card" data-policy-document-id="${escapeHtml(document.id || '')}">
      <div class="saved-document-icon">${icon('file-text',20)}</div>
      <div class="saved-document-copy"><span>${escapeHtml(document.document_type || 'Practice document')}</span><h3>${escapeHtml(document.title || 'Untitled document')}</h3><small>${document.updated_at ? `Updated ${escapeHtml(formatSavedDate(document.updated_at))}` : 'Saved to your practice library'}${document.version ? ` · Version ${Number(document.version)}` : ''}</small></div>
    </article>`).join('')}</div>` : ''}
  </section>`
}

export function renderPolicyPage({ category = 'All', savedDocuments = [], loading = false, error = '' } = {}) {
  const list = category === 'All' ? policyTemplates : policyTemplates.filter((item) => item.category === category)
  return `<section class="feature-page policy-page">
    <div class="page-heading-row"><div><span class="eyebrow">DOCUMENTS & TEMPLATES</span><h1>Policy Library</h1><p>Create, customise and organise practical documents for your practice.</p></div><button class="primary-button" type="button" data-action="create-document">${icon('file-plus',18)} Create document</button></div>
    ${renderSavedDocuments(savedDocuments, { loading, error })}
    <div class="policy-template-heading"><div><span class="eyebrow">STARTING POINTS</span><h2>Templates</h2><p>Use a template or describe any practice document you need.</p></div></div>
    <div class="filter-tabs" role="tablist">${policyCategories.map((item)=>`<button type="button" role="tab" class="filter-tab ${item===category?'active':''}" data-policy-filter="${item}">${item}</button>`).join('')}</div>
    <div class="template-grid">${list.map((item)=>`<article class="template-card"><div class="template-icon">${icon(item.category==='Checklists'?'clipboard':'file-text',22)}</div><div class="template-meta"><span>${escapeHtml(item.category)}</span>${item.sampleContent ? '<span>Sample ready</span>' : ''}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><div class="card-actions"><button class="text-button" type="button" data-action="preview-template" data-template-id="${item.id}">${icon('eye',15)} Preview</button><button class="primary-small" type="button" data-action="create-template" data-template-id="${item.id}">Create from template</button></div></article>`).join('')}</div>
  </section>`
}

export function renderTemplatePreview(template) {
  if (!template) return ''
  const items = Array.isArray(template.sampleContent) ? template.sampleContent : [
    'Review the purpose and scope for your practice.',
    'Confirm the nominated owner and responsibilities.',
    'Customise the workflow to match local systems and services.',
    'Approve, communicate and schedule a review date.',
  ]
  return `<div class="dialog-backdrop" data-dialog="template-preview"><section class="dialog checklist-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>
    <div class="dialog-heading"><span class="eyebrow">SAMPLE CHECKLIST</span><h2 id="template-preview-title">${escapeHtml(template.title)}</h2><p>${escapeHtml(template.description)}</p></div>
    <div class="checklist-preview-list">${items.map((item, index)=>`<label class="checklist-preview-item"><input class="check-box" type="checkbox" aria-label="Mark checklist item ${index + 1} complete"/><div><strong>${index + 1}</strong><span>${escapeHtml(item)}</span></div></label>`).join('')}</div>
    <div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">Close</button><button class="primary-button" type="button" data-action="create-template" data-template-id="${template.id}">Customise this checklist</button></div>
  </section></div>`
}

export function renderDocumentWizard(template = null, values = {}, generated = false, draft = null, { submitting = false, error = '' } = {}) {
  const documentType = String(values.documentType || template?.title || '')
  const considerations = String(values.considerations || '')
  const draftTitle = String(draft?.title || documentType || 'Practice document')
  const draftContent = String(draft?.content || (generated && template ? generateDocumentDraft(template, values) : ''))
  const sourceLabel = template ? 'CREATE FROM TEMPLATE' : 'CREATE DOCUMENT'

  return `<div class="dialog-backdrop" data-dialog="document"><div class="dialog document-dialog" role="dialog" aria-modal="true" aria-labelledby="document-dialog-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>
    ${generated ? `
      <div class="dialog-heading"><span class="eyebrow">DRAFT READY</span><h2 id="document-dialog-title">${escapeHtml(draftTitle)}</h2><p>Review and edit the draft before saving it to your practice Policy Library. Saving a document does not automatically make an accreditation requirement ready.</p></div>
      ${error ? `<div class="form-alert">${icon('alert',16)} ${escapeHtml(error)}</div>` : ''}
      <textarea class="draft-editor" data-draft-editor aria-label="Generated document draft">${escapeHtml(draftContent)}</textarea>
      <div class="dialog-actions"><button class="secondary-button" type="button" data-action="back-wizard">Back</button><button class="secondary-button" type="button" data-action="download-document">${icon('external',15)} Download</button><button class="primary-button" type="button" data-action="save-draft" ${submitting ? 'disabled' : ''}>${submitting ? 'Saving…' : 'Save to Policy Library'}</button></div>
    ` : `
      <div class="dialog-heading"><span class="eyebrow">${sourceLabel}</span><h2 id="document-dialog-title">${template ? escapeHtml(template.title) : 'Create a practice document'}</h2><p>Tell MediQo what you need and any practice-specific details to consider. AI will prepare a comprehensive editable draft for you to review.</p></div>
      ${error ? `<div class="form-alert">${icon('alert',16)} ${escapeHtml(error)}</div>` : ''}
      <form data-document-form class="wizard-form">
        <label class="field"><span>What document do you need?</span><input autofocus name="documentType" value="${escapeHtml(documentType)}" placeholder="e.g. Privacy Incident Response Procedure" required /></label>
        <label class="field"><span>What should MediQo consider when creating this?</span><textarea name="considerations" placeholder="Add your practice workflow, roles, services, local process, wording preferences or anything else MediQo should account for.">${escapeHtml(considerations)}</textarea></label>
        ${template ? `<div class="document-template-context"><strong>Template starting point</strong><span>${escapeHtml(template.description || template.title)}</span></div>` : ''}
        <p class="document-ai-note">MediQo will create a draft for practice review. Where current legal, regulatory or accreditation requirements need verification, the draft will identify that rather than inventing a requirement.</p>
        <div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">Cancel</button><button class="primary-button" type="submit" ${submitting ? 'disabled' : ''}>${submitting ? 'Generating…' : `Generate draft ${icon('chevron',16)}`}</button></div>
      </form>
    `}
  </div></div>`
}

export function generateDocumentDraft(template, values = {}) {
  const practice = values.practiceName || 'Your practice'
  const owner = values.owner || 'Practice Manager'
  const cycle = values.reviewCycle || 'Annual'
  const notes = values.notes ? `\nPractice-specific notes\n${values.notes}\n` : ''
  const checklist = Array.isArray(template?.sampleContent) ? `\nSuggested checklist\n${template.sampleContent.map((item)=>`• ${item}`).join('\n')}\n` : ''
  const title = template?.title || values.documentType || 'Practice Document'
  return `${title}\n\nPractice: ${practice}\nDocument owner: ${owner}\nReview cycle: ${cycle}\n\nPurpose\nThis draft provides a practical starting point for ${String(title).toLowerCase()} and is intended to be reviewed and customised by the practice before use.\n${checklist}\nResponsibilities\n• ${owner} maintains this document and coordinates updates.\n• Team members follow the approved workflow and raise gaps or incidents promptly.\n• Evidence and completion records are stored in the agreed practice location.\n${notes}\nReview\nReview this document ${cycle.toLowerCase()} and whenever a material workflow or regulatory requirement changes.`
}
