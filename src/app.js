import { renderShell } from './components/shell.js'
import { renderAskHome, renderAnswerView, renderFallbackView, renderComposer } from './components/chat.js'
import { renderAccreditationPage } from './components/accreditation.js'
import { renderPolicyPage, renderDocumentWizard } from './components/policies.js'
import { renderReportsPage, renderReportDialog, accreditationSummary } from './components/reports.js'
import { renderAlertsPage } from './components/alerts.js'
import { renderProductPage } from './components/product-page.js'
import { renderSignupDialog, renderPmsDialog, renderHelpDialog, renderEvidenceDialog } from './components/dialogs.js'
import { getProduct } from './data/products.js'
import { policyTemplates } from './data/policies.js'
import { fallbackSuggestions } from './data/demo-questions.js'
import { assistantService } from './services/assistant-service.js'
import { authService } from './services/auth-service.js'
import { leadService } from './services/lead-service.js'
import { pmsService } from './services/pms-service.js'
import { loadPrototypeState, savePrototypeState, resetPrototypeState } from './lib/persistence.js'
import { validateSignup } from './lib/validation.js'
import { canAskWithoutSignup, recordAnsweredQuestion, unlockWithUser } from './lib/prototype-rules.js'
import { signupSuccessMessage } from './lib/ui-copy.js'
import { icon } from './components/icons.js'

const root = document.querySelector('#app')
const toastRoot = document.querySelector('#toast-root')
const devMode = ['localhost', '127.0.0.1'].includes(location.hostname)

const ui = {
  path: location.pathname,
  query: new URLSearchParams(location.search),
  alertsOpen: false,
  userMenuOpen: false,
  mobileOpen: false,
  dialog: null,
  dialogData: {},
  chat: null,
  loading: false,
  error: '',
  policyCategory: 'All',
  openAlertId: null,
  calendarSelection: {},
  pendingQuestion: '',
  lastFocused: null,
}

let prototype = loadPrototypeState()

function currentProduct() {
  const match = ui.path.match(/^\/products\/([^/]+)$/)
  return match ? getProduct(match[1]) : null
}

function pageContent() {
  if (ui.path === '/') {
    if (ui.loading && ui.chat?.question) {
      return renderLoadingQuestion(ui.chat.question)
    }
    if (ui.chat?.answer) return renderAnswerView(ui.chat.answer, ui.chat.question, { saved: prototype.savedAnswerIds.includes(ui.chat.answer.id) })
    if (ui.chat?.fallback) return renderFallbackView(ui.chat.question, fallbackSuggestions)
    if (ui.error && ui.chat?.question) return renderAssistantError(ui.chat.question, ui.error)
    return renderAskHome()
  }
  if (ui.path === '/accreditation') return renderAccreditationPage(prototype.accreditationOverrides)
  if (ui.path === '/policies') return renderPolicyPage({ category: ui.policyCategory })
  if (ui.path === '/reports') return renderReportsPage({ savedAnswerIds: prototype.savedAnswerIds, accreditationOverrides: prototype.accreditationOverrides })
  if (ui.path === '/alerts') return renderAlertsPage(ui.openAlertId)
  const product = currentProduct()
  if (product) return renderProductPage(product, ui.calendarSelection[product.slug] || {})
  return `<section class="feature-page"><h1>Page not found</h1><p>Return to <a href="/" data-nav="/">Ask a Question</a>.</p></section>`
}

function renderLoadingQuestion(question) {
  return `<section class="conversation-page"><div class="conversation-grid"><div class="conversation-main">
    <div class="user-message-row"><div class="user-bubble"><span>${escapeText(question)}</span><small>Today, 10:24 AM</small></div><span class="message-avatar user-icon">${icon('users',18)}</span></div>
    <div class="assistant-loading"><span class="assistant-orb">${icon('sparkle',20)}</span><div class="typing" aria-label="MediQo is preparing an answer"><i></i><i></i><i></i></div></div>
  </div><aside class="related-rail"><section class="rail-card"><div class="rail-heading">${icon('sparkle',20)}<strong>Preparing answer</strong></div><p class="rail-copy">MediQo is matching this question to the available practice-manager knowledge set.</p></section></aside></div><div class="conversation-composer-wrap">${renderComposer({compact:true,loading:true})}</div></section>`
}

function renderAssistantError(question, message) {
  return `<section class="conversation-page"><div class="conversation-grid"><div class="conversation-main">
    <div class="user-message-row"><div class="user-bubble"><span>${escapeText(question)}</span><small>Today, 10:24 AM</small></div><span class="message-avatar user-icon">${icon('users',18)}</span></div>
    <div class="assistant-message-row"><span class="assistant-orb">${icon('alert',20)}</span><article class="assistant-answer"><h2 style="font-size:16px;color:#0d1b4d;margin:0 0 6px">We couldn’t prepare that answer</h2><p>${escapeText(message)}</p><button class="primary-button" type="button" data-action="retry-question">Retry</button></article></div>
  </div><aside class="related-rail"><section class="rail-card"><div class="rail-heading">${icon('help',20)}<strong>Try again</strong></div><p class="rail-copy">You can retry the same question or choose one of the prepared suggestions.</p></section></aside></div><div class="conversation-composer-wrap">${renderComposer({compact:true})}</div></section>`
}

function dialogMarkup() {
  if (ui.dialog === 'signup') return renderSignupDialog(ui.dialogData)
  if (ui.dialog === 'pms') return renderPmsDialog()
  if (ui.dialog === 'help') return renderHelpDialog()
  if (ui.dialog === 'evidence') return renderEvidenceDialog()
  if (ui.dialog === 'report') return renderReportDialog(ui.dialogData.reportId, { savedAnswerIds: prototype.savedAnswerIds, accreditationOverrides: prototype.accreditationOverrides })
  if (ui.dialog === 'document') {
    const template = policyTemplates.find((item) => item.id === ui.dialogData.templateId)
    return renderDocumentWizard(template, ui.dialogData.values || {}, ui.dialogData.generated || false)
  }
  return ''
}

function render({ focusDialog = false } = {}) {
  const content = pageContent()
  root.innerHTML = renderShell({
    path: ui.path,
    content,
    alertsOpen: ui.alertsOpen,
    userMenuOpen: ui.userMenuOpen,
    mobileOpen: ui.mobileOpen,
    sidebarCollapsed: prototype.sidebarCollapsed,
    devMode,
    selectedPractice: prototype.selectedPractice || 'Riverside Medical Centre',
  }) + dialogMarkup()

  installLogoFallback()
  if (focusDialog && ui.dialog) queueMicrotask(focusFirstDialogControl)
  if (ui.path === '/policies' && ui.query.get('template') && !ui.dialog) {
    const id = ui.query.get('template')
    if (policyTemplates.some((item) => item.id === id)) {
      ui.dialog = 'document'
      ui.dialogData = { templateId: id, values: {}, generated: false }
      history.replaceState({}, '', '/policies')
      ui.query = new URLSearchParams()
      render({ focusDialog: true })
    }
  }
}

function installLogoFallback() {
  document.querySelectorAll('img[data-logo-fallback]').forEach((img) => {
    const handleError = () => {
      if (img.dataset.fallbackTried === '1') {
        img.classList.add('failed')
        img.closest('.calendar-logo-mark')?.classList.add('logo-failed')
        return
      }
      img.dataset.fallbackTried = '1'
      img.src = img.dataset.logoFallback
    }
    img.addEventListener('error', handleError)
    if (img.complete && !img.naturalWidth) handleError()
  })
}

function navigate(target) {
  const url = new URL(target, location.origin)
  history.pushState({}, '', `${url.pathname}${url.search}`)
  ui.path = url.pathname
  ui.query = new URLSearchParams(url.search)
  ui.alertsOpen = false
  ui.userMenuOpen = false
  ui.mobileOpen = false
  ui.error = ''
  render()
  window.scrollTo({ top: 0, behavior: 'auto' })
}

async function submitQuestion(rawQuestion) {
  const question = String(rawQuestion || '').trim()
  if (!question || ui.loading) return
  if (!canAskWithoutSignup(prototype)) {
    ui.pendingQuestion = question
    openDialog('signup', { trial: false, errors: {}, values: defaultSignupValues() })
    return
  }

  ui.error = ''
  ui.loading = true
  ui.chat = { question }
  render()
  try {
    const result = await assistantService.ask(question)
    if (result.answer) {
      if (!prototype.user) {
        recordAnsweredQuestion(prototype)
        savePrototypeState(prototype)
      }
      ui.chat = { question, answer: result.answer }
    } else {
      ui.chat = { question, fallback: true }
    }
  } catch (error) {
    ui.error = error?.message || 'Please try again.'
    ui.chat = { question }
  } finally {
    ui.loading = false
    render()
  }
}

function defaultSignupValues() {
  return {
    clinicName: prototype.user?.clinicName || 'Riverside Medical Centre',
    firstName: prototype.user?.firstName || '',
    lastName: prototype.user?.lastName || '',
    jobTitle: prototype.user?.jobTitle || 'Practice Manager',
    email: prototype.user?.email || '',
    password: '',
    locations: ['NSW'],
  }
}

function openDialog(type, data = {}) {
  ui.lastFocused = document.activeElement
  ui.dialog = type
  ui.dialogData = data
  render({ focusDialog: true })
}

function closeDialog() {
  const restore = ui.lastFocused
  ui.dialog = null
  ui.dialogData = {}
  render()
  if (restore && typeof restore.focus === 'function') queueMicrotask(() => restore.focus())
}

function focusFirstDialogControl() {
  const dialog = document.querySelector('.dialog')
  if (!dialog) return
  const autofocus = dialog.querySelector('[autofocus]')
  const first = autofocus || dialog.querySelector('button, input, textarea, select, [tabindex]:not([tabindex="-1"])')
  first?.focus()
}

function trapDialogTab(event) {
  const dialog = document.querySelector('.dialog')
  if (!dialog || event.key !== 'Tab') return
  const focusables = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus()
  }
}

function showToast(message, kind = 'success') {
  const node = document.createElement('div')
  node.className = `toast ${kind}`
  node.innerHTML = `${icon(kind === 'success' ? 'check' : 'alert', 16)}<span>${escapeText(message)}</span>`
  toastRoot.appendChild(node)
  setTimeout(() => node.remove(), 2800)
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]))
}

function collectSignup(form) {
  const data = new FormData(form)
  return {
    clinicName: data.get('clinicName') || '',
    firstName: data.get('firstName') || '',
    lastName: data.get('lastName') || '',
    jobTitle: data.get('jobTitle') || '',
    email: data.get('email') || '',
    password: data.get('password') || '',
    locations: data.getAll('locations'),
  }
}

async function handleSignup(form) {
  const values = collectSignup(form)
  const errors = validateSignup(values)
  if (Object.keys(errors).length) {
    ui.dialogData = { ...ui.dialogData, values, errors, submitting: false }
    render({ focusDialog: true })
    return
  }

  ui.dialogData = { ...ui.dialogData, values, errors: {}, submitting: true, serverError: '' }
  render()
  try {
    const trial = Boolean(ui.dialogData.trial)
    const user = await authService.createAccount(values)
    await leadService.submit(values)
    unlockWithUser(prototype, user)
    prototype.selectedPractice = user.clinicName
    savePrototypeState(prototype)
    const pending = ui.pendingQuestion
    ui.pendingQuestion = ''
    ui.dialog = null
    ui.dialogData = {}
    render()
    showToast(signupSuccessMessage(trial))
    if (pending) await submitQuestion(pending)
  } catch (error) {
    ui.dialogData = { ...ui.dialogData, values, errors: {}, submitting: false, serverError: error?.message || 'Could not create account. Please try again.' }
    render({ focusDialog: true })
  }
}

function saveCurrentAnswer() {
  const id = ui.chat?.answer?.id
  if (!id) return
  if (!prototype.savedAnswerIds.includes(id)) prototype.savedAnswerIds.push(id)
  savePrototypeState(prototype)
  render()
  showToast('Answer saved')
}

function updateAccreditation(select) {
  prototype.accreditationOverrides[select.dataset.accreditationId] = select.value
  savePrototypeState(prototype)
  render()
  showToast('Accreditation status updated')
}

function renderPolicyPreview(template) {
  openDialog('document', { templateId: template.id, values: defaultDocumentValues(), generated: true })
}

function defaultDocumentValues() {
  return { practiceName: prototype.selectedPractice || 'Riverside Medical Centre', owner: 'Practice Manager', reviewCycle: 'Annual', notes: '' }
}

function handleDocumentForm(form) {
  const data = new FormData(form)
  ui.dialogData = {
    ...ui.dialogData,
    values: Object.fromEntries(data.entries()),
    generated: true,
  }
  render({ focusDialog: true })
}

function downloadReport(reportId = 'practice') {
  const accreditation = accreditationSummary(prototype.accreditationOverrides)
  const reportCopy = {
    accreditation: ['Accreditation Readiness Summary', `Current readiness: ${accreditation.score}%`, `Priority gaps: ${accreditation.priorityGaps}`, `Upcoming expiry: ${accreditation.upcomingExpiry}`],
    policies: ['Policy Coverage Summary', 'Current policies: 14', 'Due for review: 3', 'Priority areas: 2'],
    training: ['Training & Expiry Summary', 'Due soon: 4', 'Current: 18', 'Needs evidence: 2'],
    advice: ['Recent Advice / Saved Answers', `Saved practice answers: ${Math.max(3, prototype.savedAnswerIds.length)}`],
  }
  const lines = [
    'MediQo Practice Report',
    prototype.selectedPractice || 'Riverside Medical Centre',
    '',
    ...(reportCopy[reportId] || ['Practice summary']),
    '',
    'Generated from the current MediQo workspace.',
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `MediQo-${reportId}-report.txt`
  a.click()
  URL.revokeObjectURL(url)
  showToast('Report downloaded')
}
function confirmDemo() {
  const product = currentProduct()
  const selection = product ? ui.calendarSelection[product.slug] : null
  if (!selection?.time) {
    showToast('Choose a time first', 'error')
    return
  }
  showToast(`Demo time selected: ${selection.date} Oct at ${selection.time}`)
}

root.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-nav]')
  if (nav) {
    event.preventDefault()
    navigate(nav.dataset.nav)
    return
  }

  const suggestion = event.target.closest('[data-suggestion]')
  if (suggestion) {
    await submitQuestion(suggestion.dataset.suggestion)
    return
  }

  const related = event.target.closest('[data-related-question]')
  if (related) {
    await submitQuestion(related.dataset.relatedQuestion)
    return
  }

  const filter = event.target.closest('[data-policy-filter]')
  if (filter) {
    ui.policyCategory = filter.dataset.policyFilter
    render()
    return
  }

  const createTemplate = event.target.closest('[data-template-id]')
  if (createTemplate && createTemplate.dataset.action === 'create-template') {
    openDialog('document', { templateId: createTemplate.dataset.templateId, values: defaultDocumentValues(), generated: false })
    return
  }
  if (createTemplate && createTemplate.dataset.action === 'preview-template') {
    const template = policyTemplates.find((item) => item.id === createTemplate.dataset.templateId)
    if (template) renderPolicyPreview(template)
    return
  }

  const dateButton = event.target.closest('[data-calendar-date]')
  if (dateButton) {
    const product = currentProduct(); if (!product) return
    ui.calendarSelection[product.slug] = { ...(ui.calendarSelection[product.slug] || {}), date: Number(dateButton.dataset.calendarDate), time: '' }
    render(); return
  }
  const timeButton = event.target.closest('[data-calendar-time]')
  if (timeButton) {
    const product = currentProduct(); if (!product) return
    ui.calendarSelection[product.slug] = { date: ui.calendarSelection[product.slug]?.date || 5, time: timeButton.dataset.calendarTime }
    render(); return
  }

  const actionEl = event.target.closest('[data-action]')
  if (!actionEl) return
  const action = actionEl.dataset.action

  if (action === 'toggle-alerts') { ui.alertsOpen = !ui.alertsOpen; ui.userMenuOpen = false; render(); return }
  if (action === 'toggle-practice-menu') { showToast(`${prototype.selectedPractice || 'Riverside Medical Centre'} is the active practice`); return }
  if (action === 'attach-file') { actionEl.closest('form')?.querySelector('.attachment-input')?.click(); return }
  if (action === 'answer-helpful' || action === 'answer-not-helpful') { showToast('Thanks for your feedback'); return }
  if (action === 'resource-unavailable') { showToast('Resource link is not available in this environment'); return }
  if (action === 'toggle-user-menu' || action === 'toggle-user-menu-top') { ui.userMenuOpen = !ui.userMenuOpen; ui.alertsOpen = false; render(); return }
  if (action === 'toggle-sidebar') { prototype.sidebarCollapsed = !prototype.sidebarCollapsed; savePrototypeState(prototype); render(); return }
  if (action === 'toggle-mobile-nav') { ui.mobileOpen = !ui.mobileOpen; render(); return }
  if (action === 'close-mobile-nav') { ui.mobileOpen = false; render(); return }
  if (action === 'connect-pms') { openDialog('pms'); return }
  if (action === 'help') { openDialog('help'); return }
  if (action === 'evidence-info') { openDialog('evidence'); return }
  if (action === 'close-dialog') { closeDialog(); return }
  if (action === 'pms-demo-confirm') { await pmsService.connect(); closeDialog(); showToast('PMS selection saved'); return }
  if (action === 'save-answer') { saveCurrentAnswer(); return }
  if (action === 'retry-question') { if (ui.chat?.question) await submitQuestion(ui.chat.question); return }
  if (action === 'ask-accreditation') { navigate('/'); await submitQuestion('For accreditation, what certificates do I need from our doctors?'); return }
  if (action === 'create-document') { openDialog('document', { templateId: 'new-receptionist-onboarding', values: defaultDocumentValues(), generated: false }); return }
  if (action === 'back-wizard') { ui.dialogData.generated = false; render({focusDialog:true}); return }
  if (action === 'save-draft') { closeDialog(); showToast('Draft saved to Policy Library'); return }
  if (action === 'preview-report') { openDialog('report', { reportId: actionEl.dataset.reportId }); return }
  if (action === 'download-report') { downloadReport(actionEl.dataset.reportId || 'practice'); return }
  if (action === 'toggle-alert') { ui.openAlertId = ui.openAlertId === actionEl.dataset.alertId ? null : actionEl.dataset.alertId; render(); return }
  if (action === 'scroll-calendar') { document.querySelector('#demo-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
  if (action === 'start-trial') { openDialog('signup', { trial: true, errors: {}, values: defaultSignupValues() }); return }
  if (action === 'confirm-demo') { confirmDemo(); return }
  if (action === 'toggle-password') {
    const input = actionEl.closest('.password-wrap')?.querySelector('input')
    if (input) input.type = input.type === 'password' ? 'text' : 'password'
    return
  }
  if (action === 'terms' || action === 'privacy') { event.preventDefault(); showToast('Legal links will connect to MediQo policy pages'); return }
  if (action === 'reset-prototype') {
    if (confirm('Reset local MediQo data in this browser?')) {
      resetPrototypeState(); prototype = loadPrototypeState(); ui.chat = null; ui.userMenuOpen = false; render(); showToast('Local data reset')
    }
  }
})

root.addEventListener('submit', async (event) => {
  const form = event.target
  if (form.matches('[data-chat-form]')) {
    event.preventDefault()
    const textarea = form.querySelector('textarea[name="question"]')
    await submitQuestion(textarea?.value || '')
    return
  }
  if (form.matches('[data-signup-form]')) {
    event.preventDefault(); await handleSignup(form); return
  }
  if (form.matches('[data-document-form]')) {
    event.preventDefault(); handleDocumentForm(form); return
  }
})

root.addEventListener('input', (event) => {
  const textarea = event.target.closest('.chat-composer textarea')
  if (textarea) {
    const count = textarea.closest('.chat-composer')?.querySelector('.char-count')
    if (count) count.textContent = `${textarea.value.length}/500`
  }
})

root.addEventListener('keydown', (event) => {
  const textarea = event.target.closest('.chat-composer textarea')
  if (textarea && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault(); textarea.closest('form')?.requestSubmit()
  }
})

root.addEventListener('change', (event) => {
  const attachment = event.target.closest('.attachment-input')
  if (attachment) {
    const name = attachment.files?.[0]?.name || ''
    const label = attachment.closest('.chat-composer')?.querySelector('.attachment-name')
    if (label) label.textContent = name ? `Selected: ${name}` : ''
    return
  }
  const select = event.target.closest('[data-accreditation-id]')
  if (select) updateAccreditation(select)
})

document.addEventListener('keydown', (event) => {
  if (ui.dialog) {
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return }
    trapDialogTab(event)
  }
})

window.addEventListener('popstate', () => {
  ui.path = location.pathname
  ui.query = new URLSearchParams(location.search)
  ui.dialog = null
  ui.alertsOpen = false
  ui.userMenuOpen = false
  render()
})

render()
