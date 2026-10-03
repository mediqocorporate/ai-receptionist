import { policyCategories, policyTemplates, wizardQuestions } from '../data/policies.js'
import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

export function renderPolicyPage({ category = 'All' } = {}) {
  const list = category === 'All' ? policyTemplates : policyTemplates.filter((item) => item.category === category)
  return `<section class="feature-page policy-page">
    <div class="page-heading-row"><div><span class="eyebrow">DOCUMENTS & TEMPLATES</span><h1>Policy Library</h1><p>Create, customise and organise practical documents for your practice.</p></div><button class="primary-button" type="button" data-action="create-document">${icon('file-plus',18)} Create document</button></div>
    <div class="filter-tabs" role="tablist">${policyCategories.map((item)=>`<button type="button" role="tab" class="filter-tab ${item===category?'active':''}" data-policy-filter="${item}">${item}</button>`).join('')}</div>
    <div class="template-grid">${list.map((item)=>`<article class="template-card"><div class="template-icon">${icon(item.category==='Checklists'?'clipboard':'file-text',22)}</div><div class="template-meta"><span>${escapeHtml(item.category)}</span></div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><div class="card-actions"><button class="text-button" type="button" data-action="preview-template" data-template-id="${item.id}">${icon('eye',15)} Preview</button><button class="primary-small" type="button" data-action="create-template" data-template-id="${item.id}">Create from template</button></div></article>`).join('')}</div>
  </section>`
}

export function renderDocumentWizard(template, values = {}, generated = false) {
  if (!template) return ''
  const fields = wizardQuestions.map((q)=>`<label class="field"><span>${escapeHtml(q.label)}</span>${q.key==='notes'?`<textarea name="${q.key}" placeholder="${escapeHtml(q.placeholder)}">${escapeHtml(values[q.key]||'')}</textarea>`:`<input name="${q.key}" value="${escapeHtml(values[q.key]||'')}" placeholder="${escapeHtml(q.placeholder)}" />`}</label>`).join('')
  const draft = generated ? generateDocumentDraft(template, values) : ''
  return `<div class="dialog-backdrop" data-dialog="document"><div class="dialog document-dialog" role="dialog" aria-modal="true" aria-labelledby="document-dialog-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon('x',20)}</button>${generated?`<div class="dialog-heading"><span class="eyebrow">DRAFT READY</span><h2 id="document-dialog-title">${escapeHtml(template.title)}</h2><p>Edit the draft before saving it to the practice library.</p></div><textarea class="draft-editor" data-draft-editor>${escapeHtml(draft)}</textarea><div class="dialog-actions"><button class="secondary-button" type="button" data-action="back-wizard">Back</button><button class="primary-button" type="button" data-action="save-draft">Save draft</button></div>`:`<div class="dialog-heading"><span class="eyebrow">CREATE FROM TEMPLATE</span><h2 id="document-dialog-title">${escapeHtml(template.title)}</h2><p>Answer a few practice-specific questions and MediQo will prepare a draft.</p></div><form data-document-form class="wizard-form">${fields}<div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">Cancel</button><button class="primary-button" type="submit">Generate draft ${icon('chevron',16)}</button></div></form>`}</div></div>`
}

export function generateDocumentDraft(template, values = {}) {
  const practice = values.practiceName || 'Riverside Medical Centre'
  const owner = values.owner || 'Practice Manager'
  const cycle = values.reviewCycle || 'Annual'
  const notes = values.notes ? `\nPractice-specific notes\n${values.notes}\n` : ''
  return `${template.title}\n\nPractice: ${practice}\nDocument owner: ${owner}\nReview cycle: ${cycle}\n\nPurpose\nThis draft provides a practical starting point for ${template.title.toLowerCase()} and is intended to be reviewed and customised by the practice before use.\n\nResponsibilities\n• ${owner} maintains this document and coordinates updates.\n• Team members follow the approved workflow and raise gaps or incidents promptly.\n• Evidence and completion records are stored in the agreed practice location.\n${notes}\nReview\nReview this document ${cycle.toLowerCase()} and whenever a material workflow or regulatory requirement changes.`
}
