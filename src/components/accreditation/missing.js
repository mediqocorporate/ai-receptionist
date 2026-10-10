import { escapeHtml } from '../../lib/html.js'
import { icon } from '../icons.js'

const ISSUE_LABELS = {
  CONFIRMED_GAP: 'Confirmed gap',
  NEEDS_ATTENTION: 'Needs attention',
  EVIDENCE_OUTDATED: 'Evidence outdated',
  EVIDENCE_INCOMPLETE: 'Evidence incomplete',
  EVIDENCE_CONFLICTING: 'Evidence conflicting',
  EVIDENCE_MORE_INFORMATION_REQUIRED: 'More evidence information needed',
  EVIDENCE_REVIEW_PENDING: 'Evidence review pending',
  MISSING_POLICY: 'Missing policy',
  MISSING_EVIDENCE: 'Missing evidence',
  APPLICABILITY_TO_CONFIRM: 'Applicability to confirm',
  RECHECK_REQUIRED: 'Re-check required',
  NOT_CHECKED: 'Not checked',
}

function issueLabel(code) {
  return ISSUE_LABELS[code] || String(code || '').replaceAll('_', ' ').toLowerCase()
}

function issueClass(code) {
  if (code === 'CONFIRMED_GAP' || code === 'EVIDENCE_CONFLICTING') return 'danger'
  if (code === 'NEEDS_ATTENTION' || code === 'EVIDENCE_OUTDATED' || code === 'EVIDENCE_INCOMPLETE' || code === 'EVIDENCE_MORE_INFORMATION_REQUIRED') return 'warning'
  if (code === 'MISSING_POLICY' || code === 'MISSING_EVIDENCE' || code === 'EVIDENCE_REVIEW_PENDING') return 'evidence'
  return 'neutral'
}

function priorityClass(priority) {
  return String(priority || 'LOW').toLowerCase()
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function evidenceExpectations(item) {
  const expected = Array.isArray(item.expectedEvidence) ? item.expectedEvidence : []
  if (!expected.length) return ''
  return `<div class="missing-expected-evidence"><span class="label">Expected evidence</span>${expected.map((entry) => `<div><strong>${escapeHtml(entry.type || 'Supporting evidence')}</strong>${entry.rule ? `<span>${escapeHtml(entry.rule)}</span>` : ''}</div>`).join('')}</div>`
}

function assignmentMeta(item) {
  if (!item.ownerName && !item.dueDate) return ''
  return `<div class="missing-assignment-meta">
    ${item.ownerName ? `<span>${icon('users',14)} ${escapeHtml(item.ownerName)}</span>` : ''}
    ${item.dueDate ? `<span>${icon('calendar',14)} Due ${escapeHtml(formatDate(item.dueDate))}</span>` : ''}
  </div>`
}

function itemCard(item) {
  const codes = Array.isArray(item.issueCodes) ? item.issueCodes : []
  return `<article class="panel missing-item-card ${item.criticalSafetyArea ? 'critical' : ''}">
    <div class="missing-item-topline">
      <div class="missing-item-identity">
        <span class="eyebrow">${escapeHtml(item.indicator || item.requirementId || '')}</span>
        <h3>${escapeHtml(item.title || '')}</h3>
      </div>
      <div class="missing-item-priority"><span class="missing-priority ${priorityClass(item.priority)}">${escapeHtml(item.priority || 'LOW')} priority</span>${item.criticalSafetyArea ? '<span class="critical-safety-badge">Critical safety</span>' : ''}</div>
    </div>
    <div class="missing-issue-chips">${codes.map((code) => `<span class="missing-issue-chip ${issueClass(code)}">${escapeHtml(issueLabel(code))}</span>`).join('')}</div>
    <div class="missing-item-grid">
      <div><span class="label">Why this is shown</span><p>${escapeHtml(item.whyShown || '')}</p></div>
      <div><span class="label">Next action</span><p>${escapeHtml(item.nextAction || '')}</p></div>
    </div>
    ${evidenceExpectations(item)}
    <div class="missing-item-footer">
      ${assignmentMeta(item)}
      <div class="missing-item-actions">
        <button type="button" class="secondary-button" data-action="accreditation-create-action" data-requirement-id="${escapeHtml(item.requirementId || '')}" data-requirement-indicator="${escapeHtml(item.indicator || '')}" data-requirement-title="${escapeHtml(item.title || '')}" data-priority="${escapeHtml(item.priority || 'MEDIUM')}" data-source-reason="${escapeHtml(item.whyShown || '')}" data-description="${escapeHtml(item.nextAction || '')}">Create action</button>
        <button type="button" class="secondary-button" data-accreditation-requirement="${escapeHtml(item.requirementId || '')}" data-accreditation-return-view="missing">Review requirement ${icon('chevron',14)}</button>
      </div>
    </div>
  </article>`
}

function section(title, copy, items, { limit = null, empty = '' } = {}) {
  const list = limit ? items.slice(0, limit) : items
  if (!list.length && !empty) return ''
  return `<section class="missing-section">
    <div class="missing-section-heading"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><span class="count-pill">${items.length}</span></div>
    ${list.length ? `<div class="missing-items-list">${list.map(itemCard).join('')}</div>` : `<div class="panel accreditation-empty-state"><p>${escapeHtml(empty)}</p></div>`}
    ${limit && items.length > limit ? `<div class="missing-section-more"><span>${items.length - limit} more requirement${items.length - limit === 1 ? '' : 's'} still need checking.</span><button type="button" class="secondary-button" data-accreditation-view="requirements">View all requirements</button></div>` : ''}
  </section>`
}

export function renderAccreditationMissing(data = {}, { loading = false, error = '' } = {}) {
  if (!data?.summary && !error) {
    return '<section class="panel accreditation-loading-state"><p>Loading what’s missing…</p></section>'
  }
  if (error && !data?.summary) {
    return `<section class="panel accreditation-error-state"><div><h2>Could not load What’s Missing</h2><p>${escapeHtml(error)}</p></div></section>`
  }

  const summary = data?.summary || {}
  const items = Array.isArray(data?.items) ? data.items : []
  const priorityItems = items.filter((item) => (item.issueCodes || []).some((code) => !['NOT_CHECKED','APPLICABILITY_TO_CONFIRM'].includes(code)))
  const applicabilityItems = items.filter((item) => (item.issueCodes || []).includes('APPLICABILITY_TO_CONFIRM') && !priorityItems.includes(item))
  const uncheckedItems = items.filter((item) => (item.issueCodes || []).includes('NOT_CHECKED') && !priorityItems.includes(item) && !applicabilityItems.includes(item))

  return `<section class="missing-workspace">
    <section class="panel missing-intro-panel">
      <div><span class="eyebrow">GAP ANALYSIS</span><h2>What’s Missing</h2><p>MediQo brings together your readiness answers, practice information and mapped evidence to show what still needs attention before assessment preparation.</p></div>
      <div class="missing-trust-note">${icon('shield-check',18)}<span><strong>Unknown stays unknown.</strong> Unknown information is not treated as a confirmed gap, and uploaded evidence does not change readiness until it is reviewed.</span></div>
    </section>

    <section class="missing-summary-grid" aria-label="What's Missing summary">
      <article class="panel missing-summary-card confirmed"><span>Confirmed gaps</span><strong>${Number(summary.confirmedGaps || 0)}</strong><small>Explicitly reported gaps</small></article>
      <article class="panel missing-summary-card attention"><span>Needs attention</span><strong>${Number(summary.needsAttention || 0)}</strong><small>Follow-up required</small></article>
      <article class="panel missing-summary-card evidence"><span>Evidence follow-up</span><strong>${Number(summary.evidenceIssues || 0)}</strong><small>Missing, pending or reviewed issues</small></article>
      <article class="panel missing-summary-card unknown"><span>Still to confirm</span><strong>${Number(summary.applicabilityToConfirm || 0) + Number(summary.notChecked || 0)}</strong><small>Applicability or assessment still unknown</small></article>
    </section>

    ${items.length === 0 ? `<section class="panel accreditation-empty-state missing-clear-state"><h3>No outstanding items are currently identified</h3><p>This does not certify accreditation readiness. Continue reviewing requirements and evidence as your practice information changes.</p></section>` : ''}
    ${section('Priority gaps and evidence follow-up', 'Confirmed gaps, needs-attention requirements and evidence issues are shown first.', priorityItems)}
    ${section('Applicability to confirm', 'These requirements cannot be classified as applicable or not applicable until the relevant practice facts are confirmed.', applicabilityItems)}
    ${section('Still to check', 'These requirements are not confirmed gaps. MediQo still needs enough information to assess them.', uncheckedItems, { limit: 8 })}
  </section>`
}
