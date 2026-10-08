import { icon } from '../icons.js'
import { escapeHtml } from '../../lib/html.js'

const DEMO_STEPS = [
  {
    eyebrow: 'EXAMPLE PRACTICE · OVERVIEW',
    title: 'Riverside Medical Centre',
    body: 'See how MediQo separates assessment coverage from readiness and keeps unknown information visible.',
    content: '<div class="explore-metric-grid"><div><span>Quick Check</span><strong>65%</strong><small>13 of 20 priority requirements answered</small></div><div><span>Needs Attention</span><strong>8</strong><small>Follow-up or evidence is still needed</small></div><div><span>Confirmed Gap</span><strong>2</strong><small>Known issues to fix and re-check</small></div></div>',
  },
  {
    eyebrow: 'EXAMPLE PRACTICE · REQUIREMENT',
    title: 'Understand one requirement',
    body: 'MediQo explains what is known, what remains unknown and the next practical action instead of asking the Practice Manager to decide whether the practice complies.',
    content: '<div class="explore-example-panel"><strong>C7.1C · Content of patient health records</strong><span class="status-pill status-confirmed-gap">Confirmed Gap</span><p>Example fact: the practice reported that the required record content is not consistently present.</p></div>',
  },
  {
    eyebrow: 'EXAMPLE PRACTICE · EVIDENCE',
    title: 'Check the evidence',
    body: 'Evidence can be mapped to requirements and reviewed for relevance, completeness and currency without turning an uploaded file into an automatic ready result.',
    content: '<div class="explore-example-panel"><strong>Patient record audit</strong><span class="status-pill status-needs-attention">Needs Attention</span><p>Example review: relevant evidence was found, but the sample does not yet show consistent coverage.</p></div>',
  },
  {
    eyebrow: 'EXAMPLE PRACTICE · WHAT\'S MISSING',
    title: 'Turn gaps into practical work',
    body: 'MediQo surfaces confirmed gaps, evidence issues and still-to-check items so the team can see what to fix next.',
    content: '<div class="explore-example-panel"><strong>Next action</strong><p>Review the patient-record workflow, complete a new audit and link the updated evidence before re-checking C7.1C.</p></div>',
  },
  {
    eyebrow: 'EXAMPLE PRACTICE · READINESS REPORT',
    title: 'Prepare without hiding uncertainty',
    body: 'The readiness report keeps incomplete coverage, unresolved gaps and evidence issues visible. It is preparation guidance, not a certification or pass/fail result.',
    content: '<div class="explore-example-panel"><strong>Example report summary</strong><p>Coverage 82% · 3 confirmed gaps · 11 items need attention · 22 requirements still not checked.</p></div>',
  },
]

export function renderAccreditationExplore({ step = 0 } = {}) {
  const index = Math.max(0, Math.min(DEMO_STEPS.length - 1, Number(step) || 0))
  const current = DEMO_STEPS[index]
  return `<section class="accreditation-explore">
    <div class="explore-banner"><div><span class="eyebrow">EXAMPLE PRACTICE</span><strong>Riverside Medical Centre</strong><p>This is fictional demonstration data. Exploring it does not change your practice.</p></div><button class="secondary-button" type="button" data-action="accreditation-exit-explore">Exit Explore</button></div>
    <article class="panel explore-stage">
      <div class="explore-progress"><span>Step ${index + 1} of ${DEMO_STEPS.length}</span><div class="coverage-bar"><span style="width:${Math.round(((index + 1) / DEMO_STEPS.length) * 100)}%"></span></div></div>
      <span class="eyebrow">${escapeHtml(current.eyebrow)}</span>
      <h2>${escapeHtml(current.title)}</h2>
      <p>${escapeHtml(current.body)}</p>
      ${current.content}
      <div class="dialog-actions"><button class="secondary-button" type="button" data-action="accreditation-explore-prev" ${index === 0 ? 'disabled' : ''}>${icon('chevron',15)} Back</button>${index < DEMO_STEPS.length - 1 ? `<button class="primary-button" type="button" data-action="accreditation-explore-next">Next ${icon('chevron',15)}</button>` : '<button class="primary-button" type="button" data-action="accreditation-start-setup">Set up my accreditation</button>'}</div>
    </article>
  </section>`
}
