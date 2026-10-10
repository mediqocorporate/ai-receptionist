import { escapeHtml } from '../../lib/html.js'
import { icon } from '../icons.js'

const STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
}

function statusLabel(value) {
  return STATUS_LABELS[value] || String(value || '').replaceAll('_', ' ')
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function selected(value, expected) {
  return String(value || '') === String(expected || '') ? ' selected' : ''
}

function editorForm(editor = {}, owners = []) {
  const editing = Boolean(editor.id)
  return `<section class="panel accreditation-action-editor">
    <div class="panel-heading">
      <div><span class="eyebrow">${editing ? 'EDIT ACTION' : 'NEW ACTION'}</span><h2>${editing ? 'Update accreditation action' : 'Create accreditation action'}</h2><p>Track the practical work needed to close gaps and prepare for assessment.</p></div>
      <button type="button" class="secondary-button" data-action="accreditation-cancel-action">Cancel</button>
    </div>
    ${editor.requirementId ? `<div class="action-linked-requirement"><span class="label">Linked requirement</span><strong>${escapeHtml(editor.requirementIndicator || editor.requirementId)}${editor.requirementTitle ? ` · ${escapeHtml(editor.requirementTitle)}` : ''}</strong></div>` : ''}
    <form class="accreditation-action-form" data-accreditation-action-form>
      <input type="hidden" name="actionId" value="${escapeHtml(editor.id || '')}">
      <input type="hidden" name="requirementId" value="${escapeHtml(editor.requirementId || '')}">
      <input type="hidden" name="sourceReason" value="${escapeHtml(editor.sourceReason || '')}">
      <label class="field span-2"><span>Action title</span><input name="title" maxlength="200" required value="${escapeHtml(editor.title || '')}" placeholder="e.g. Update patient record process"></label>
      <label class="field span-2"><span>Description</span><textarea name="description" rows="3" maxlength="4000" placeholder="What needs to be completed?">${escapeHtml(editor.description || '')}</textarea></label>
      <label class="field"><span>Priority</span><select name="priority">
        <option value="LOW"${selected(editor.priority || 'MEDIUM', 'LOW')}>Low</option>
        <option value="MEDIUM"${selected(editor.priority || 'MEDIUM', 'MEDIUM')}>Medium</option>
        <option value="HIGH"${selected(editor.priority || 'MEDIUM', 'HIGH')}>High</option>
        <option value="CRITICAL"${selected(editor.priority || 'MEDIUM', 'CRITICAL')}>Critical</option>
      </select></label>
      <label class="field"><span>Owner</span><select name="ownerUserId"><option value="">Unassigned</option>${owners.map((owner) => `<option value="${escapeHtml(owner.id)}"${selected(editor.ownerUserId, owner.id)}>${escapeHtml(owner.name)}${owner.jobTitle ? ` · ${escapeHtml(owner.jobTitle)}` : ''}</option>`).join('')}</select></label>
      <label class="field"><span>Due date</span><input type="date" name="dueDate" value="${escapeHtml(editor.dueDate || '')}"></label>
      <label class="field"><span>Status</span><select name="status">
        <option value="OPEN"${selected(editor.status || 'OPEN', 'OPEN')}>Open</option>
        <option value="IN_PROGRESS"${selected(editor.status || 'OPEN', 'IN_PROGRESS')}>In progress</option>
        <option value="BLOCKED"${selected(editor.status || 'OPEN', 'BLOCKED')}>Blocked</option>
        <option value="DONE"${selected(editor.status || 'OPEN', 'DONE')}>Done</option>
      </select></label>
      <label class="field span-2"><span>Completion note</span><textarea name="completionNote" rows="2" maxlength="2000" placeholder="Optional. Record what was completed or what still needs re-checking.">${escapeHtml(editor.completionNote || '')}</textarea></label>
      <div class="action-form-note span-2">${icon('shield-check',16)} Completing an action does not change readiness. Re-check the linked requirement and evidence separately.</div>
      <div class="action-form-actions span-2"><button type="submit" class="primary-button" ${editor.submitting ? 'disabled' : ''}>${editor.submitting ? 'Saving…' : editing ? 'Save changes' : 'Create action'}</button></div>
    </form>
  </section>`
}

function actionCard(item) {
  return `<article class="panel accreditation-action-card ${item.overdue ? 'overdue' : ''}">
    <div class="action-card-top">
      <div>
        ${item.requirementIndicator ? `<span class="eyebrow">${escapeHtml(item.requirementIndicator)}</span>` : '<span class="eyebrow">ACCREDITATION ACTION</span>'}
        <h3>${escapeHtml(item.title || '')}</h3>
      </div>
      <div class="action-badges"><span class="action-priority ${String(item.priority || '').toLowerCase()}">${escapeHtml(item.priority || 'MEDIUM')} priority</span><span class="action-status ${String(item.status || '').toLowerCase()}">${escapeHtml(statusLabel(item.status))}</span>${item.overdue ? '<span class="action-overdue">Overdue</span>' : ''}</div>
    </div>
    ${item.description ? `<p class="action-description">${escapeHtml(item.description)}</p>` : ''}
    ${item.sourceReason ? `<div class="action-source"><span class="label">Why this action exists</span><p>${escapeHtml(item.sourceReason)}</p></div>` : ''}
    <div class="action-meta">
      <span>${icon('users',15)} ${escapeHtml(item.ownerName || 'Unassigned')}</span>
      <span>${icon('calendar',15)} ${item.dueDate ? `Due ${escapeHtml(formatDate(item.dueDate))}` : 'No due date'}</span>
      ${item.requirementTitle ? `<span>${icon('shield-check',15)} ${escapeHtml(item.requirementTitle)}</span>` : ''}
    </div>
    ${item.completionNote ? `<div class="action-completion"><span class="label">Completion note</span><p>${escapeHtml(item.completionNote)}</p></div>` : ''}
    <div class="action-card-actions">
      ${item.requirementId ? `<button type="button" class="secondary-button" data-accreditation-requirement="${escapeHtml(item.requirementId)}" data-accreditation-return-view="actions">Review requirement ${icon('chevron',14)}</button>` : ''}
      <button type="button" class="secondary-button" data-action="accreditation-edit-action" data-action-id="${escapeHtml(item.id || '')}">Edit action</button>
    </div>
  </article>`
}

export function renderAccreditationActions(state = {}) {
  if (!state.loaded && !state.error) {
    return '<section class="panel accreditation-loading-state"><p>Loading accreditation actions…</p></section>'
  }
  if (state.error && !state.loaded) {
    return `<section class="panel accreditation-error-state"><div><h2>Could not load Actions</h2><p>${escapeHtml(state.error)}</p></div></section>`
  }

  const summary = state.summary || {}
  const owners = Array.isArray(state.owners) ? state.owners : []
  const items = Array.isArray(state.items) ? state.items : []
  const filters = state.filters || { status: 'ALL', priority: 'ALL', owner: 'ALL' }
  const filtered = items.filter((item) => {
    if (filters.status && filters.status !== 'ALL' && item.status !== filters.status) return false
    if (filters.priority && filters.priority !== 'ALL' && item.priority !== filters.priority) return false
    if (filters.owner && filters.owner !== 'ALL' && (item.ownerUserId || 'UNASSIGNED') !== filters.owner) return false
    return true
  })

  return `<section class="accreditation-actions-workspace">
    <section class="panel actions-intro">
      <div><span class="eyebrow">CLOSING GAPS</span><h2>Actions</h2><p>Turn accreditation gaps and follow-up into practical work with clear owners, due dates and status.</p></div>
      <button type="button" class="primary-button" data-action="accreditation-new-action">${icon('plus',16)} Create action</button>
    </section>

    <div class="actions-trust-note">${icon('shield-check',17)} <span><strong>Actions track work; they do not decide readiness.</strong> Completing an action does not change readiness until the linked requirement is re-checked using current facts and evidence.</span></div>

    <section class="actions-summary-grid">
      <article class="panel action-summary-card"><span>Open</span><strong>${Number(summary.open || 0)}</strong></article>
      <article class="panel action-summary-card"><span>In progress</span><strong>${Number(summary.inProgress || 0)}</strong></article>
      <article class="panel action-summary-card"><span>Blocked</span><strong>${Number(summary.blocked || 0)}</strong></article>
      <article class="panel action-summary-card"><span>Overdue</span><strong>${Number(summary.overdue || 0)}</strong></article>
    </section>

    ${state.editor ? editorForm(state.editor, owners) : ''}

    <section class="panel actions-toolbar">
      <div><strong>Action list</strong><span>${filtered.length} shown</span></div>
      <div class="actions-filters">
        <label><span>Status</span><select data-accreditation-action-filter="status">
          <option value="ALL"${selected(filters.status || 'ALL', 'ALL')}>All statuses</option>
          <option value="OPEN"${selected(filters.status, 'OPEN')}>Open</option>
          <option value="IN_PROGRESS"${selected(filters.status, 'IN_PROGRESS')}>In progress</option>
          <option value="BLOCKED"${selected(filters.status, 'BLOCKED')}>Blocked</option>
          <option value="DONE"${selected(filters.status, 'DONE')}>Done</option>
        </select></label>
        <label><span>Priority</span><select data-accreditation-action-filter="priority">
          <option value="ALL"${selected(filters.priority || 'ALL', 'ALL')}>All priorities</option>
          <option value="CRITICAL"${selected(filters.priority, 'CRITICAL')}>Critical</option>
          <option value="HIGH"${selected(filters.priority, 'HIGH')}>High</option>
          <option value="MEDIUM"${selected(filters.priority, 'MEDIUM')}>Medium</option>
          <option value="LOW"${selected(filters.priority, 'LOW')}>Low</option>
        </select></label>
        <label><span>Owner</span><select data-accreditation-action-filter="owner">
          <option value="ALL"${selected(filters.owner || 'ALL', 'ALL')}>All owners</option>
          <option value="UNASSIGNED"${selected(filters.owner, 'UNASSIGNED')}>Unassigned</option>
          ${owners.map((owner) => `<option value="${escapeHtml(owner.id)}"${selected(filters.owner, owner.id)}>${escapeHtml(owner.name)}</option>`).join('')}
        </select></label>
      </div>
    </section>

    ${state.error ? `<div class="accreditation-inline-error">${icon('alert',15)} ${escapeHtml(state.error)}</div>` : ''}
    ${filtered.length ? `<div class="accreditation-action-list">${filtered.map(actionCard).join('')}</div>` : `<section class="panel accreditation-empty-state"><h3>No actions match these filters</h3><p>Create an action from What’s Missing or use Create action to add work manually.</p></section>`}
  </section>`
}
