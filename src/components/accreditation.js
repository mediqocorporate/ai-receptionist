import { accreditationItems } from '../data/accreditation.js'
import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

export function renderAccreditationPage(overrides = {}, options = {}) {
  const items = accreditationItems.map((item) => ({ ...item, status: overrides[item.id] || item.status }))
  const ready = items.filter((item) => item.status === 'Ready').length
  const score = Math.round((ready / items.length) * 100)
  const outstanding = items.filter((item) => item.status !== 'Ready')
  const nextPriority = outstanding.find((item) => item.status === 'Action required') || outstanding[0]
  const practiceName = options.practiceName || 'Riverside Medical Centre'
  const targetDate = options.targetDate || 'March 2027'

  return `<section class="feature-page accreditation-page">
    <div class="page-heading-row"><div><span class="eyebrow">ACCREDITATION ASSISTANT · PHASE 1</span><h1>Your accreditation plan</h1><p>MediQo translates RACGP Standards into practical requirements, evidence and next actions for ${escapeHtml(practiceName)}.</p></div><button type="button" class="primary-button" data-action="ask-accreditation">${icon('message-circle',17)} Ask accreditation question</button></div>

    <section class="manual-to-guided">
      <div><span class="eyebrow">TODAY</span><strong>Manual accreditation preparation</strong><p>Standards, spreadsheets, folders, documents, emails and staff follow-up are managed separately by the Practice Manager.</p></div>
      <span class="manual-flow-arrow">${icon('chevron', 19)}</span>
      <div><span class="eyebrow">WITH MEDIQO</span><strong>From manual preparation to a guided plan</strong><p>One guided plan translates the standards, shows the evidence required and prioritises what needs to happen next.</p></div>
    </section>

    <section class="panel accreditation-plan-summary">
      <div><span class="label">Practice</span><strong>${escapeHtml(practiceName)}</strong></div>
      <div><span class="label">Target assessment</span><strong>${escapeHtml(targetDate)}</strong></div>
      <div><span class="label">Current readiness</span><strong>${score}% ready</strong></div>
      <div><span class="label">Next priority</span><strong>${escapeHtml(nextPriority?.requirement || 'Review your plan')}</strong></div>
    </section>

    <div class="accreditation-steps">
      <article><span>1</span><div><strong>Understand requirements</strong><small>Plain-English guidance on what the practice actually needs to do.</small></div></article>
      <article><span>2</span><div><strong>Complete your checklist</strong><small>Requirements, policies, training and outstanding actions in one plan.</small></div></article>
      <article><span>3</span><div><strong>Gather evidence</strong><small>See the evidence required for every relevant accreditation requirement.</small></div></article>
      <article><span>4</span><div><strong>Close outstanding actions</strong><small>Prioritise gaps before the independent assessment.</small></div></article>
    </div>

    <div class="readiness-grid">
      <article class="readiness-card readiness-score"><div class="ring" style="--score:${score * 3.6}deg"><div><strong>${score}%</strong><span>ready</span></div></div><div><span class="label">Current readiness</span><h2>${ready} of ${items.length} requirements ready</h2><p>Readiness based on your current evidence and selected RACGP Standards edition.</p></div></article>
      <article class="readiness-card"><span class="label">Priority gaps</span><strong class="big-number">${items.filter((i)=>i.status==='Action required').length}</strong><p>Items marked action required</p></article>
      <article class="readiness-card"><span class="label">Outstanding actions</span><strong class="big-number">${outstanding.length}</strong><p>Requirements still needing work or evidence</p></article>
    </div>

    <div class="feature-split">
      <section class="panel requirements-panel"><div class="panel-heading"><div><h2>Requirements & evidence checklist</h2><p>Current RACGP edition · translated into practical requirements for your practice</p></div><div class="legend"><span><i class="status-dot ready"></i>Ready</span><span><i class="status-dot needs-evidence"></i>Needs evidence</span><span><i class="status-dot expiring-soon"></i>Expiring soon</span><span><i class="status-dot action-required"></i>Action required</span></div></div>
        <div class="table-wrap"><table class="data-table accreditation-table"><thead><tr><th>Requirement</th><th>What you need to do</th><th>Evidence required</th><th>Status</th><th>Due</th></tr></thead><tbody>${items.map((item)=>`<tr><td><strong>${escapeHtml(item.requirement)}</strong><small>${escapeHtml(item.area)} · ${escapeHtml(item.owner)}</small></td><td class="action-cell">${escapeHtml(item.action)}</td><td class="evidence-cell">${escapeHtml(item.evidence)}</td><td><select class="status-select ${statusClass(item.status)}" data-accreditation-id="${item.id}" aria-label="Status for ${escapeHtml(item.requirement)}"><option ${item.status==='Ready'?'selected':''}>Ready</option><option ${item.status==='Needs evidence'?'selected':''}>Needs evidence</option><option ${item.status==='Expiring soon'?'selected':''}>Expiring soon</option><option ${item.status==='Action required'?'selected':''}>Action required</option></select></td><td>${escapeHtml(item.due)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <aside class="accreditation-side">
        <section class="panel"><div class="panel-heading"><div><h2>What needs attention</h2><p>Highest-priority preparation items</p></div></div>${outstanding.slice(0,4).map((item)=>`<div class="gap-row"><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span><div><strong>${escapeHtml(item.requirement)}</strong><small>${escapeHtml(item.action)}</small></div></div>`).join('')}</section>
        <section class="panel future-flow"><span class="eyebrow">Phase 2 preview</span><span class="future-icon">${icon('sparkle',22)}</span><h3>Evidence assessment and accreditation automation</h3><p>Future phases can organise uploaded evidence, assess gaps, monitor policies, recommend updates, explain regulatory changes, run pre-accreditation reviews and generate mock assessor questions.</p><button class="secondary-button" type="button" data-action="evidence-info">Preview evidence assessment</button></section>
      </aside>
    </div>
  </section>`
}
