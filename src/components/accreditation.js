import { accreditationItems } from '../data/accreditation.js'
import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

export function renderAccreditationPage(overrides = {}) {
  const items = accreditationItems.map((item) => ({ ...item, status: overrides[item.id] || item.status }))
  const ready = items.filter((item) => item.status === 'Ready').length
  const score = Math.round((ready / items.length) * 100)
  return `<section class="feature-page accreditation-page">
    <div class="page-heading-row"><div><span class="eyebrow">ACCREDITATION ASSISTANT</span><h1>Accreditation readiness</h1><p>See your evidence, gaps and next actions in one calm workspace.</p></div><button type="button" class="primary-button" data-action="ask-accreditation">${icon('message-circle',17)} Ask accreditation question</button></div>
    <div class="readiness-grid">
      <article class="readiness-card readiness-score"><div class="ring" style="--score:${score * 3.6}deg"><div><strong>${score}%</strong><span>ready</span></div></div><div><span class="label">Current readiness</span><h2>${ready} of ${items.length} items ready</h2><p>Readiness based on your current evidence and selected RACGP Standards edition.</p></div></article>
      <article class="readiness-card"><span class="label">Priority gaps</span><strong class="big-number">${items.filter((i)=>i.status==='Action required').length}</strong><p>Items marked action required</p></article>
      <article class="readiness-card"><span class="label">Upcoming expiry</span><strong class="big-number">${items.filter((i)=>i.status==='Expiring soon').length}</strong><p>Evidence items due soon</p></article>
    </div>
    <div class="feature-split">
      <section class="panel requirements-panel"><div class="panel-heading"><div><h2>Requirements & evidence</h2><p>Current RACGP edition · readiness register</p></div><div class="legend"><span><i class="status-dot ready"></i>Ready</span><span><i class="status-dot needs-evidence"></i>Needs evidence</span><span><i class="status-dot expiring-soon"></i>Expiring soon</span><span><i class="status-dot action-required"></i>Action required</span></div></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Requirement</th><th>Status</th><th>Owner</th><th>Due</th></tr></thead><tbody>${items.map((item)=>`<tr><td><strong>${escapeHtml(item.requirement)}</strong><small>${escapeHtml(item.area)} · ${escapeHtml(item.evidence)}</small></td><td><select class="status-select ${statusClass(item.status)}" data-accreditation-id="${item.id}" aria-label="Status for ${escapeHtml(item.requirement)}"><option ${item.status==='Ready'?'selected':''}>Ready</option><option ${item.status==='Needs evidence'?'selected':''}>Needs evidence</option><option ${item.status==='Expiring soon'?'selected':''}>Expiring soon</option><option ${item.status==='Action required'?'selected':''}>Action required</option></select></td><td>${escapeHtml(item.owner)}</td><td>${escapeHtml(item.due)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <aside class="accreditation-side">
        <section class="panel"><div class="panel-heading"><div><h2>What needs attention</h2><p>Highest-priority preparation items</p></div></div>${items.filter((i)=>i.status!=='Ready').slice(0,4).map((item)=>`<div class="gap-row"><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span><div><strong>${escapeHtml(item.requirement)}</strong><small>${escapeHtml(item.due)}</small></div></div>`).join('')}</section>
        <section class="panel future-flow"><span class="future-icon">${icon('sparkle',22)}</span><h3>Evidence assessment</h3><p>Upload evidence and MediQo can map it to the selected standards edition, surface gaps and propose the next action for review.</p><button class="secondary-button" type="button" data-action="evidence-info">How evidence assessment works</button></section>
      </aside>
    </div>
  </section>`
}
