import { renderShell } from './components/shell.js'
import { renderAskHome, renderConversationView, renderComposer, formatMessageTimestamp } from './components/chat.js'
import { renderAccreditationPage } from './components/accreditation.js'
import { renderPolicyPage, renderDocumentWizard, renderTemplatePreview } from './components/policies.js'
import { renderAlertsPage } from './components/alerts.js'
import { renderProductPage, shiftCalendarSelection, formatCalendarDate } from './components/product-page.js'
import { renderSignupDialog, renderLoginDialog, renderTrialRequestDialog, renderFeatureRequestDialog, renderPmsDialog, renderHelpDialog, renderEvidenceDialog } from './components/dialogs.js'
import { getProduct } from './data/products.js'
import { policyTemplates } from './data/policies.js'
import { fallbackSuggestions } from './data/demo-questions.js'
import { assistantService } from './services/assistant-service.js'
import { authService } from './services/auth-service.js'
import { leadService } from './services/lead-service.js'
import { questionService } from './services/question-service.js'
import { pmsService } from './services/pms-service.js'
import { accreditationService } from './services/accreditation-service.js'
import { policyDocumentService } from './services/policy-document-service.js'
import { loadPrototypeState, savePrototypeState, resetPrototypeState } from './lib/persistence.js'
import { validateSignup } from './lib/validation.js'
import { canAskWithoutSignup, recordAnsweredQuestion } from './lib/prototype-rules.js'
import { shouldRecordLocalQuestion, shouldUseLocalQuestionGate } from './lib/qna-mode.js'
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
  conversationTurns: [],
  pendingTurn: null,
  failedQuestion: '',
  loading: false,
  error: '',
  policyCategory: 'All',
  policyDocuments: { loading: false, error: '', items: [] },
  openAlertId: null,
  calendarSelection: {},
  pendingQuestion: '',
  conversationId: null,
  scrollConversationMode: '',
  accreditation: {
    loading: false,
    submitting: false,
    error: '',
    view: 'overview',
    filter: 'ALL',
    overview: null,
    requirement: null,
    exploreStep: 0,
    setup: { step: 1, values: {}, submitting: false, error: '', complete: false },
    practiceInformation: null,
    practiceInformationLoading: false,
    practiceInformationEditing: false,
    practiceInformationSubmitting: false,
    practiceInformationError: '',
    comprehensive: null,
    comprehensiveLoading: false,
  },
  lastFocused: null,
}

let prototype = loadPrototypeState()
let appUser = null

function currentProduct() {
  const match = ui.path.match(/^\/products\/([^/]+)$/)
  return match ? getProduct(match[1]) : null
}

function pageContent() {
  if (ui.path === '/') {
    const hasConversation = ui.conversationTurns.length > 0 || ui.pendingTurn || ui.failedQuestion
    if (hasConversation) {
      return renderConversationView(ui.conversationTurns, {
        savedAnswerIds: prototype.savedAnswerIds,
        loading: ui.loading,
        pendingQuestion: ui.pendingTurn?.question || '',
        pendingAskedAt: ui.pendingTurn?.askedAt || null,
        error: ui.error,
        failedQuestion: ui.failedQuestion,
        fallbackSuggestions,
      })
    }
    return renderAskHome({ signedIn: Boolean(appUser), history: prototype.questionHistory })
  }
  if (ui.path === '/accreditation') return renderAccreditationPage(ui.accreditation, {
    practiceName: appUser?.clinicName || prototype.selectedPractice || 'Riverside Medical Centre',
    signedIn: Boolean(appUser),
  })
  if (ui.path === '/policies') return renderPolicyPage({ category: ui.policyCategory, savedDocuments: ui.policyDocuments.items, loading: ui.policyDocuments.loading, error: ui.policyDocuments.error })
  if (ui.path === '/alerts') return renderAlertsPage(ui.openAlertId)
  const product = currentProduct()
  if (product) return renderProductPage(product, ui.calendarSelection[product.slug] || {})
  return `<section class="feature-page"><h1>Page not found</h1><p>Return to <a href="/" data-nav="/">Ask a Question</a>.</p></section>`
}

function renderLoadingQuestion(question) {
  return `<section class="conversation-page"><div class="conversation-grid"><div class="conversation-main">
    <div class="user-message-row"><div class="user-bubble"><span>${escapeText(question)}</span><small>${escapeText(formatMessageTimestamp())}</small></div><span class="message-avatar user-icon">${icon('users',18)}</span></div>
    <div class="assistant-loading"><span class="assistant-orb">${icon('sparkle',20)}</span><div class="typing" aria-label="MediQo is preparing an answer"><i></i><i></i><i></i></div></div>
  </div><aside class="related-rail"><section class="rail-card"><div class="rail-heading">${icon('sparkle',20)}<strong>Preparing answer</strong></div><p class="rail-copy">MediQo is matching this question to the available practice-manager knowledge set.</p></section></aside></div><div class="conversation-composer-wrap">${renderComposer({compact:true,loading:true})}</div></section>`
}

function renderAssistantError(question, message) {
  return `<section class="conversation-page"><div class="conversation-grid"><div class="conversation-main">
    <div class="user-message-row"><div class="user-bubble"><span>${escapeText(question)}</span><small>${escapeText(formatMessageTimestamp())}</small></div><span class="message-avatar user-icon">${icon('users',18)}</span></div>
    <div class="assistant-message-row"><span class="assistant-orb">${icon('alert',20)}</span><article class="assistant-answer"><h2 style="font-size:16px;color:#0d1b4d;margin:0 0 6px">We couldn’t prepare that answer</h2><p>${escapeText(message)}</p><button class="primary-button" type="button" data-action="retry-question">Retry</button></article></div>
  </div><aside class="related-rail"><section class="rail-card"><div class="rail-heading">${icon('help',20)}<strong>Try again</strong></div><p class="rail-copy">You can retry the same question or choose one of the prepared suggestions.</p></section></aside></div><div class="conversation-composer-wrap">${renderComposer({compact:true})}</div></section>`
}

function dialogMarkup() {
  if (ui.dialog === 'signup') return renderSignupDialog(ui.dialogData)
  if (ui.dialog === 'login') return renderLoginDialog(ui.dialogData)
  if (ui.dialog === 'trial-request') return renderTrialRequestDialog(ui.dialogData)
  if (ui.dialog === 'feature-request') return renderFeatureRequestDialog(ui.dialogData)
  if (ui.dialog === 'pms') return renderPmsDialog(ui.dialogData)
  if (ui.dialog === 'help') return renderHelpDialog()
  if (ui.dialog === 'evidence') return renderEvidenceDialog()
  if (ui.dialog === 'document') {
    const template = policyTemplates.find((item) => item.id === ui.dialogData.templateId) || null
    return renderDocumentWizard(
      template,
      ui.dialogData.values || {},
      ui.dialogData.generated || false,
      ui.dialogData.draft || null,
      { submitting: Boolean(ui.dialogData.submitting), error: ui.dialogData.serverError || '' },
    )
  }
  if (ui.dialog === 'template-preview') {
    const template = policyTemplates.find((item) => item.id === ui.dialogData.templateId)
    return renderTemplatePreview(template)
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
    selectedPractice: appUser?.clinicName || prototype.selectedPractice || 'Riverside Medical Centre',
    user: appUser,
    accreditationView: ui.accreditation.view,
  }) + dialogMarkup()

  installLogoFallback()
  activateHubSpotEmbeds()
  scrollConversationIntoView()
  if (focusDialog && ui.dialog) queueMicrotask(focusFirstDialogControl)
  if (ui.path === '/policies' && ui.query.get('template') && !ui.dialog) {
    const id = ui.query.get('template')
    if (policyTemplates.some((item) => item.id === id)) {
      ui.dialog = 'document'
      const template = policyTemplates.find((item) => item.id === id)
      ui.dialogData = { templateId: id, values: defaultDocumentValues(template), generated: false, draft: null, submitting: false, serverError: '' }
      history.replaceState({}, '', '/policies')
      ui.query = new URLSearchParams()
      render({ focusDialog: true })
    }
  }
}

function scrollConversationIntoView() {
  const mode = ui.scrollConversationMode
  if (!mode || ui.path !== '/') return
  ui.scrollConversationMode = ''
  queueMicrotask(() => {
    const selector = mode === 'pending' ? '[data-chat-pending]' : '[data-chat-latest]'
    const target = root.querySelector(selector)
    target?.scrollIntoView({
      behavior: 'smooth',
      block: mode === 'pending' ? 'end' : 'start',
    })
  })
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

function reloadEmbedScript(id, src) {
  document.getElementById(id)?.remove()
  const script = document.createElement('script')
  script.id = id
  script.src = src
  script.async = true
  document.body.appendChild(script)
}

function activateHubSpotEmbeds() {
  if (document.querySelector('.hs-form-frame')) {
    reloadEmbedScript('mediqo-hubspot-form-script', 'https://js-ap1.hsforms.net/forms/embed/442479260.js')
  }
  if (document.querySelector('.meetings-iframe-container')) {
    reloadEmbedScript('mediqo-hubspot-meetings-script', 'https://static.hsappstatic.net/MeetingsEmbed/ex/MeetingsEmbedCode.js')
  }
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
  if (ui.path === '/accreditation' && appUser) void loadAccreditationOverview()
  if (ui.path === '/policies' && appUser) void loadPolicyDocuments()
}

async function submitQuestion(rawQuestion) {
  const question = String(rawQuestion || '').trim()
  if (!question || ui.loading) return

  const liveAssistant = assistantService.isLive()
  const canAskLocally = canAskWithoutSignup({ ...prototype, user: appUser })
  if (shouldUseLocalQuestionGate({ live: liveAssistant, user: appUser, canAsk: canAskLocally })) {
    ui.pendingQuestion = question
    openDialog('signup', { trial: false, errors: {}, values: defaultSignupValues() })
    return
  }

  const askedAt = new Date().toISOString()
  ui.error = ''
  ui.failedQuestion = ''
  ui.pendingTurn = { question, askedAt }
  ui.loading = true
  ui.scrollConversationMode = 'pending'
  render()

  try {
    const result = await assistantService.ask(question, { conversationId: ui.conversationId })
    if (result.signupRequired) {
      ui.pendingQuestion = question
      ui.pendingTurn = null
      openDialog('signup', { trial: false, errors: {}, values: defaultSignupValues() })
      return
    }

    if (result.answer) {
      if (result.conversationId) ui.conversationId = result.conversationId

      if (shouldRecordLocalQuestion({ live: liveAssistant })) {
        if (!appUser) recordAnsweredQuestion(prototype)
        if (appUser) {
          const userName = [appUser.firstName, appUser.lastName].filter(Boolean).join(' ')
          prototype.questionLog.push({
            question,
            answerId: result.answer.id,
            userName,
            email: appUser.email || '',
            practiceName: appUser.clinicName || prototype.selectedPractice || '',
            askedAt,
          })
          prototype.questionLog = prototype.questionLog.slice(-100)
        }
      }

      prototype.questionHistory.push({ question, answerId: result.answer.id, askedAt })
      prototype.questionHistory = prototype.questionHistory.slice(-12)
      savePrototypeState(prototype)
      ui.conversationTurns.push({ question, answer: result.answer, askedAt })
    } else {
      ui.conversationTurns.push({ question, fallback: true, askedAt })
    }
    ui.pendingTurn = null
    ui.scrollConversationMode = 'answer'
  } catch (error) {
    ui.pendingTurn = null
    ui.failedQuestion = question
    ui.error = error?.message || 'Please try again.'
    ui.scrollConversationMode = 'answer'
  } finally {
    ui.loading = false
    render()
  }
}

function defaultSignupValues() {
  return {
    clinicName: '',
    firstName: '',
    lastName: '',
    jobTitle: 'Practice Manager',
    email: '',
    password: '',
    locations: ['NSW'],
  }
}

function defaultLeadValues() {
  return {
    clinicName: appUser?.clinicName || '',
    firstName: appUser?.firstName || '',
    lastName: appUser?.lastName || '',
    jobTitle: appUser?.jobTitle || 'Practice Manager',
    email: appUser?.email || '',
    locations: appUser?.locations?.length ? appUser.locations : ['NSW'],
  }
}

function defaultFeatureValues() {
  const name = [appUser?.firstName, appUser?.lastName].filter(Boolean).join(' ')
  return { name, email: appUser?.email || '', practice: appUser?.clinicName || '', suggestion: '', reason: '' }
}

function collectLead(form) {
  const data = new FormData(form)
  return {
    clinicName: data.get('clinicName') || '',
    firstName: data.get('firstName') || '',
    lastName: data.get('lastName') || '',
    jobTitle: data.get('jobTitle') || '',
    email: data.get('email') || '',
    locations: data.getAll('locations'),
  }
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

async function handleTrialRequest(form) {
  const values = collectLead(form)
  const errors = {}
  if (!String(values.clinicName).trim()) errors.clinicName = 'Clinic name is required'
  if (!String(values.firstName).trim()) errors.firstName = 'First name is required'
  if (!String(values.lastName).trim()) errors.lastName = 'Last name is required'
  if (!String(values.jobTitle).trim()) errors.jobTitle = 'Job title is required'
  if (!validEmail(values.email)) errors.email = 'Enter a valid work email'
  if (!values.locations.length) errors.locations = 'Select at least one location'
  if (Object.keys(errors).length) {
    ui.dialogData = { values, errors, submitting: false }
    render({ focusDialog: true })
    return
  }
  ui.dialogData = { values, errors: {}, submitting: true }
  render()
  try {
    const product = currentProduct()
    await leadService.submit({ type: 'trial-request', ...values, product: product?.badge || product?.headline || 'MediQo' })
    closeDialog()
    showToast('Free trial request sent to the MediQo team')
  } catch (error) {
    ui.dialogData = { values, errors: {}, submitting: false, serverError: error?.message || 'Could not send the request. Please try again.' }
    render({ focusDialog: true })
  }
}

async function handleFeatureRequest(form) {
  const data = new FormData(form)
  const values = Object.fromEntries(data.entries())
  if (!String(values.name || '').trim() || !validEmail(values.email) || !String(values.suggestion || '').trim()) {
    showToast('Add your name, a valid email and a feature suggestion', 'error')
    return
  }
  ui.dialogData = { values, submitting: true }
  render()
  try {
    await leadService.submit({ type: 'feature-request', ...values })
    closeDialog()
    showToast('Feature request sent to the MediQo team')
  } catch (error) {
    ui.dialogData = { values, submitting: false, serverError: error?.message || 'Could not send the suggestion. Please try again.' }
    render({ focusDialog: true })
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
    const user = await authService.createAccount(values)
    if (user.requiresEmailConfirmation) {
      ui.dialog = null
      ui.dialogData = {}
      render()
      showToast('Check your email to confirm your MediQo account, then sign in.')
      return
    }

    appUser = user
    prototype.selectedPractice = user.clinicName
    savePrototypeState(prototype)
    await syncAuthenticatedAccountState(user)
    const pending = ui.pendingQuestion
    ui.pendingQuestion = ''
    ui.dialog = null
    ui.dialogData = {}
    render()
    showToast(signupSuccessMessage(false))
    if (pending) await submitQuestion(pending)
  } catch (error) {
    ui.dialogData = { ...ui.dialogData, values, errors: {}, submitting: false, serverError: error?.message || 'Could not create account. Please try again.' }
    render({ focusDialog: true })
  }
}

async function handleLogin(form) {
  const data = new FormData(form)
  const values = { email: data.get('email') || '', password: data.get('password') || '' }
  if (!validEmail(values.email) || !String(values.password).trim()) {
    ui.dialogData = { values: { email: values.email }, submitting: false, serverError: 'Enter your work email and password.' }
    render({ focusDialog: true })
    return
  }

  ui.dialogData = { values: { email: values.email }, submitting: true, serverError: '' }
  render()
  try {
    const user = await authService.signIn(values)
    appUser = user
    if (user?.clinicName) prototype.selectedPractice = user.clinicName
    savePrototypeState(prototype)
    await syncAuthenticatedAccountState(user)
    ui.dialog = null
    ui.dialogData = {}
    render()
    showToast('Signed in to MediQo')
    const pending = ui.pendingQuestion
    if (pending) {
      ui.pendingQuestion = ''
      await submitQuestion(pending)
    }
  } catch (error) {
    ui.dialogData = { values: { email: values.email }, submitting: false, serverError: error?.message || 'Could not sign in. Please try again.' }
    render({ focusDialog: true })
  }
}

async function syncAuthenticatedAccountState(user) {
  if (!user) return
  await leadService.syncPlatformAccount()
  try {
    prototype.questionHistory = await questionService.loadRecent(12)
    savePrototypeState(prototype)
  } catch (error) {
    console.warn('MediQo question history could not be loaded.', error)
  }
}

async function loadPolicyDocuments({ renderAfter = true } = {}) {
  if (!appUser || !policyDocumentService.isLive()) {
    ui.policyDocuments = { loading: false, error: '', items: [] }
    if (renderAfter) render()
    return
  }
  ui.policyDocuments.loading = true
  ui.policyDocuments.error = ''
  if (renderAfter) render()
  try {
    ui.policyDocuments.items = await policyDocumentService.list()
  } catch (error) {
    ui.policyDocuments.error = error?.message || 'Could not load your practice documents.'
  } finally {
    ui.policyDocuments.loading = false
    if (renderAfter) render()
  }
}

async function bootstrapAuth() {
  if (!authService.isConfigured()) return
  try {
    const restoredUser = await authService.getCurrentUser()
    if (restoredUser) {
      appUser = restoredUser
      if (restoredUser.clinicName) prototype.selectedPractice = restoredUser.clinicName
      await syncAuthenticatedAccountState(restoredUser)
      savePrototypeState(prototype)
      render()
      if (ui.path === '/accreditation') await loadAccreditationOverview()
      if (ui.path === '/policies') await loadPolicyDocuments()
    }

    await authService.onAuthStateChange(async (user) => {
      appUser = user
      if (user?.clinicName) prototype.selectedPractice = user.clinicName
      if (user) await syncAuthenticatedAccountState(user)
      render()
      if (user && ui.path === '/accreditation') await loadAccreditationOverview()
      if (user && ui.path === '/policies') await loadPolicyDocuments()
      if (!user) ui.policyDocuments = { loading: false, error: '', items: [] }
    })
  } catch (error) {
    console.warn('MediQo auth session could not be restored.', error)
  }
}

async function loadAccreditationOverview({ preserveView = true } = {}) {
  if (!appUser || !accreditationService.isLive()) return
  ui.accreditation.loading = true
  ui.accreditation.error = ''
  if (!preserveView) ui.accreditation.view = 'overview'
  render()
  try {
    ui.accreditation.overview = await accreditationService.overview()
    if (ui.accreditation.view === 'requirement' && !ui.accreditation.requirement) ui.accreditation.view = 'requirements'
  } catch (error) {
    ui.accreditation.error = error?.message || 'Could not load accreditation readiness.'
  } finally {
    ui.accreditation.loading = false
    render()
  }
}

async function loadAccreditationComprehensiveCheck() {
  const cycleId = ui.accreditation.overview?.cycle?.id
  if (!appUser || !cycleId) return
  ui.accreditation.comprehensiveLoading = true
  ui.accreditation.error = ''
  render()
  try {
    ui.accreditation.comprehensive = await accreditationService.comprehensiveCheck({ cycleId })
  } catch (error) {
    ui.accreditation.error = error?.message || 'Could not load the Comprehensive Check.'
  } finally {
    ui.accreditation.comprehensiveLoading = false
    render()
  }
}

async function loadAccreditationPracticeInformation() {
  const cycleId = ui.accreditation.overview?.cycle?.id
  if (!appUser || !cycleId) return
  ui.accreditation.practiceInformationLoading = true
  ui.accreditation.error = ''
  render()
  try {
    ui.accreditation.practiceInformation = await accreditationService.practiceInformation({ cycleId })
  } catch (error) {
    ui.accreditation.error = error?.message || 'Could not load Practice Information.'
  } finally {
    ui.accreditation.practiceInformationLoading = false
    render()
  }
}

async function handleAccreditationSetupForm(form) {
  if (!appUser || ui.accreditation.setup?.submitting) return
  const data = new FormData(form)
  const step = Math.max(1, Math.min(4, Number(form.dataset.setupStep || ui.accreditation.setup?.step || 1)))
  const values = { ...(ui.accreditation.setup?.values || {}) }
  const fields = [
    'journeyStatus',
    'assessmentScheduled',
    'targetAssessmentDate',
    'accreditingAgencyId',
    'stateOrTerritory',
    'practiceType',
    'locationsCount',
    'gpCount',
    'nursingWorkforce',
    'alliedHealth',
    'adminWorkforce',
    'vaccinations',
    'procedures',
    'telehealth',
    'pathologyCollection',
    'pointOfCareTesting',
    'vaccineStorage',
    'services',
    'notes',
  ]
  for (const field of fields) {
    if (data.has(field)) values[field] = String(data.get(field) || '')
  }

  if (step < 4) {
    ui.accreditation.setup = { step: step + 1, values, submitting: false, error: '', complete: false }
    render()
    return
  }

  const assessmentValue = String(values.assessmentScheduled || 'UNKNOWN')
  ui.accreditation.setup = { step, values, submitting: true, error: '', complete: false }
  render()
  try {
    const result = await accreditationService.setup({
      journeyStatus: values.journeyStatus || 'NOT_SURE',
      assessmentScheduled: assessmentValue === 'YES' ? true : assessmentValue === 'NO' ? false : null,
      targetAssessmentDate: values.targetAssessmentDate || null,
      accreditingAgencyId: values.accreditingAgencyId || null,
      practiceContext: {
        stateOrTerritory: values.stateOrTerritory || '',
        practiceType: values.practiceType || '',
        locationsCount: values.locationsCount ?? '',
        gpCount: values.gpCount ?? '',
        nursingWorkforce: values.nursingWorkforce ?? '',
        alliedHealth: values.alliedHealth ?? '',
        adminWorkforce: values.adminWorkforce ?? '',
        vaccinations: values.vaccinations || 'UNKNOWN',
        procedures: values.procedures || 'UNKNOWN',
        telehealth: values.telehealth || 'UNKNOWN',
        pathologyCollection: values.pathologyCollection || 'UNKNOWN',
        pointOfCareTesting: values.pointOfCareTesting || 'UNKNOWN',
        vaccineStorage: values.vaccineStorage || 'UNKNOWN',
        services: values.services || '',
        notes: values.notes || '',
      },
    })
    ui.accreditation.overview = result.overview
    ui.accreditation.requirement = null
    ui.accreditation.practiceInformation = null
    ui.accreditation.comprehensive = null
    ui.accreditation.setup = { step: 4, values, submitting: false, error: '', complete: true }
    ui.accreditation.view = 'setup'
    showToast('Accreditation workspace set up')
  } catch (error) {
    ui.accreditation.setup = { step, values, submitting: false, error: error?.message || 'Could not save accreditation setup.', complete: false }
  }
  render()
}

function accreditationPracticeInformationPayload(form) {
  const data = new FormData(form)
  const assessment = String(data.get('assessmentScheduled') || 'UNKNOWN')
  return {
    journeyStatus: String(data.get('journeyStatus') || 'NOT_SURE'),
    assessmentScheduled: assessment === 'YES' ? true : assessment === 'NO' ? false : null,
    targetAssessmentDate: String(data.get('targetAssessmentDate') || '') || null,
    accreditingAgencyId: String(data.get('accreditingAgencyId') || '') || null,
    practiceContext: {
      stateOrTerritory: String(data.get('stateOrTerritory') || ''),
      practiceType: String(data.get('practiceType') || ''),
      locationsCount: String(data.get('locationsCount') || ''),
      gpCount: String(data.get('gpCount') || ''),
      nursingWorkforce: String(data.get('nursingWorkforce') || ''),
      alliedHealth: String(data.get('alliedHealth') || ''),
      adminWorkforce: String(data.get('adminWorkforce') || ''),
      vaccinations: String(data.get('vaccinations') || 'UNKNOWN'),
      procedures: String(data.get('procedures') || 'UNKNOWN'),
      telehealth: String(data.get('telehealth') || 'UNKNOWN'),
      pathologyCollection: String(data.get('pathologyCollection') || 'UNKNOWN'),
      pointOfCareTesting: String(data.get('pointOfCareTesting') || 'UNKNOWN'),
      vaccineStorage: String(data.get('vaccineStorage') || 'UNKNOWN'),
      services: String(data.get('services') || ''),
      notes: String(data.get('notes') || ''),
    },
  }
}

async function handleAccreditationPracticeInformationForm(form) {
  if (!appUser || ui.accreditation.practiceInformationSubmitting) return
  ui.accreditation.practiceInformationSubmitting = true
  ui.accreditation.practiceInformationError = ''
  render()
  try {
    const result = await accreditationService.setup(accreditationPracticeInformationPayload(form))
    ui.accreditation.overview = result.overview
    ui.accreditation.practiceInformation = await accreditationService.practiceInformation({ cycleId: result.overview?.cycle?.id || null })
    ui.accreditation.practiceInformationEditing = false
    showToast('Practice information saved and readiness refreshed')
  } catch (error) {
    ui.accreditation.practiceInformationError = error?.message || 'Could not save practice information.'
  } finally {
    ui.accreditation.practiceInformationSubmitting = false
    render()
  }
}

async function answerAccreditationQuestion(button) {
  const overview = ui.accreditation.overview
  if (!overview?.cycle?.id || ui.accreditation.submitting) return
  const questionId = String(button.dataset.questionId || '').trim()
  const answerLabel = String(button.dataset.answerLabel || '').trim()
  if (!questionId || !answerLabel) return

  ui.accreditation.submitting = true
  ui.accreditation.error = ''
  render()
  try {
    const result = await accreditationService.answer({
      cycleId: overview.cycle.id,
      questionId,
      answerLabel,
      answerDetail: {},
    })
    ui.accreditation.overview = result.overview
    const returnRequirementId = String(button.dataset.returnRequirementId || '').trim()
    if (returnRequirementId) {
      ui.accreditation.requirement = await accreditationService.requirement({
        cycleId: result.overview?.cycle?.id || overview.cycle.id,
        requirementId: returnRequirementId,
      })
      ui.accreditation.view = 'requirement'
    } else {
      ui.accreditation.requirement = null
    }
    if (button.dataset.checkMode === 'comprehensive') {
      ui.accreditation.comprehensive = await accreditationService.comprehensiveCheck({ cycleId: result.overview?.cycle?.id || overview.cycle.id })
    }
    showToast('Readiness answer saved')
  } catch (error) {
    ui.accreditation.error = error?.message || 'Could not save this readiness answer.'
  } finally {
    ui.accreditation.submitting = false
    render()
  }
}

async function openAccreditationRequirement(requirementId) {
  const cycleId = ui.accreditation.overview?.cycle?.id
  if (!cycleId || !requirementId) return
  ui.accreditation.loading = true
  ui.accreditation.error = ''
  render()
  try {
    ui.accreditation.requirement = await accreditationService.requirement({ cycleId, requirementId })
    ui.accreditation.view = 'requirement'
  } catch (error) {
    ui.accreditation.error = error?.message || 'Could not load this accreditation requirement.'
  } finally {
    ui.accreditation.loading = false
    render()
  }
}

function saveCurrentAnswer(id) {
  if (!id) return
  if (!prototype.savedAnswerIds.includes(id)) prototype.savedAnswerIds.push(id)
  savePrototypeState(prototype)
  render()
  showToast('Answer saved')
}

function renderPolicyPreview(template) {
  openDialog('template-preview', { templateId: template.id })
}

function defaultDocumentValues(template = null) {
  return {
    documentType: template?.title || '',
    considerations: template?.description || '',
  }
}

function policyTemplateContext(template) {
  if (!template) return ''
  const sample = Array.isArray(template.sampleContent) ? template.sampleContent.map((item) => `- ${item}`).join('\n') : ''
  return [template.title, template.description, sample].filter(Boolean).join('\n')
}

async function handleDocumentForm(form) {
  if (!appUser) {
    openDialog('login', { values: {}, submitting: false, serverError: 'Sign in to create and save practice documents.' })
    return
  }
  const values = Object.fromEntries(new FormData(form).entries())
  const template = policyTemplates.find((item) => item.id === ui.dialogData.templateId) || null
  ui.dialogData = { ...ui.dialogData, values, submitting: true, serverError: '' }
  render({ focusDialog: true })
  try {
    const draft = await policyDocumentService.generate({
      documentType: values.documentType,
      considerations: values.considerations || '',
      templateContext: policyTemplateContext(template),
    })
    ui.dialogData = { ...ui.dialogData, values, draft, generated: true, submitting: false, serverError: '' }
  } catch (error) {
    ui.dialogData = { ...ui.dialogData, values, generated: false, submitting: false, serverError: error?.message || 'Could not generate this document. Please try again.' }
  }
  render({ focusDialog: true })
}

async function savePolicyDraft() {
  if (!appUser || ui.dialog !== 'document' || !ui.dialogData.draft) return
  const editor = root.querySelector('[data-draft-editor]')
  const content = String(editor?.value || '').trim()
  if (content.length < 20) {
    showToast('Add document content before saving', 'error')
    return
  }

  ui.dialogData.submitting = true
  ui.dialogData.serverError = ''
  render({ focusDialog: true })
  try {
    const values = ui.dialogData.values || {}
    const draft = ui.dialogData.draft || {}
    await policyDocumentService.save({
      title: draft.title || values.documentType || 'Practice document',
      documentType: values.documentType || draft.title || 'Practice document',
      considerations: values.considerations || '',
      content,
      sourceTemplateId: ui.dialogData.templateId || null,
      linkedRequirementIds: Array.isArray(ui.dialogData.linkedRequirementIds) ? ui.dialogData.linkedRequirementIds : [],
    })
    await loadPolicyDocuments({ renderAfter: false })
    closeDialog()
    showToast('Document saved to Policy Library')
  } catch (error) {
    ui.dialogData.submitting = false
    ui.dialogData.serverError = error?.message || 'Could not save this document. Please try again.'
    render({ focusDialog: true })
  }
}

function downloadPolicyDraft() {
  const editor = root.querySelector('[data-draft-editor]')
  const content = String(editor?.value || '').trim()
  if (!content) {
    showToast('There is no document content to download', 'error')
    return
  }
  const title = String(ui.dialogData.draft?.title || ui.dialogData.values?.documentType || 'MediQo-document').trim()
  const filename = title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'MediQo-document'
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${filename}.txt`
  anchor.click()
  URL.revokeObjectURL(url)
  showToast('Document downloaded')
}

function confirmDemo() {
  const product = currentProduct()
  const selection = product ? ui.calendarSelection[product.slug] : null
  if (!selection?.time) {
    showToast('Choose a time first', 'error')
    return
  }
  showToast(`Demo time selected: ${formatCalendarDate(selection, { shortMonth: true })} at ${selection.time}`)
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

  const historyQuestion = event.target.closest('[data-history-question]')
  if (historyQuestion) {
    await submitQuestion(historyQuestion.dataset.historyQuestion)
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
    if (!appUser) { openDialog('login', { values: {}, submitting: false, serverError: 'Sign in to create and save practice documents.' }); return }
    const template = policyTemplates.find((item) => item.id === createTemplate.dataset.templateId) || null
    openDialog('document', { templateId: createTemplate.dataset.templateId, values: defaultDocumentValues(template), generated: false, draft: null, submitting: false, serverError: '' })
    return
  }
  if (createTemplate && createTemplate.dataset.action === 'preview-template') {
    const template = policyTemplates.find((item) => item.id === createTemplate.dataset.templateId)
    if (template) renderPolicyPreview(template)
    return
  }

  const monthButton = event.target.closest('[data-calendar-month]')
  if (monthButton) {
    const product = currentProduct(); if (!product) return
    ui.calendarSelection[product.slug] = shiftCalendarSelection(ui.calendarSelection[product.slug] || {}, Number(monthButton.dataset.calendarMonth))
    render(); return
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
    ui.calendarSelection[product.slug] = { ...(ui.calendarSelection[product.slug] || {}), date: ui.calendarSelection[product.slug]?.date || 5, time: timeButton.dataset.calendarTime }
    render(); return
  }

  const accreditationView = event.target.closest('[data-accreditation-view]')
  if (accreditationView) {
    ui.accreditation.view = accreditationView.dataset.accreditationView || 'overview'
    if (ui.accreditation.view !== 'requirement') ui.accreditation.requirement = null
    render()
    if (ui.accreditation.view === 'practice-information') await loadAccreditationPracticeInformation()
    if (ui.accreditation.view === 'comprehensive') await loadAccreditationComprehensiveCheck()
    return
  }

  const accreditationFilter = event.target.closest('[data-accreditation-filter]')
  if (accreditationFilter) {
    ui.accreditation.filter = accreditationFilter.dataset.accreditationFilter || 'ALL'
    ui.accreditation.view = 'requirements'
    render()
    return
  }

  const accreditationAnswer = event.target.closest('[data-accreditation-answer]')
  if (accreditationAnswer) {
    await answerAccreditationQuestion(accreditationAnswer)
    return
  }

  const accreditationRequirement = event.target.closest('[data-accreditation-requirement]')
  if (accreditationRequirement) {
    await openAccreditationRequirement(accreditationRequirement.dataset.accreditationRequirement)
    return
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
  if (action === 'request-feature') { openDialog('feature-request', { values: defaultFeatureValues() }); return }
  if (action === 'sign-in') { openDialog('login', { values: {}, submitting: false }); return }
  if (action === 'sign-out') { await authService.signOut(); appUser = null; ui.conversationId = null; ui.conversationTurns = []; ui.pendingTurn = null; ui.failedQuestion = ''; ui.accreditation = { loading: false, submitting: false, error: '', view: 'overview', filter: 'ALL', overview: null, requirement: null, exploreStep: 0, setup: { step: 1, values: {}, submitting: false, error: '', complete: false }, practiceInformation: null, practiceInformationLoading: false, practiceInformationEditing: false, practiceInformationSubmitting: false, practiceInformationError: '', comprehensive: null, comprehensiveLoading: false }; ui.userMenuOpen = false; render(); showToast('Signed out'); return }
  if (action === 'back-to-ask-home') { location.assign('/'); return }
  if (action === 'connect-pms') { openDialog('pms', { step: 1, vendor: '', siteId: '', pairKey: '' }); return }
  if (action === 'pms-select-vendor') { ui.dialogData = { step: 2, vendor: actionEl.dataset.pmsVendor || '', siteId: '', pairKey: '' }; render({ focusDialog: true }); return }
  if (action === 'pms-continue') { const form = actionEl.closest('.pms-connection-form'); ui.dialogData = { ...ui.dialogData, step: 3, siteId: form?.querySelector('[name="siteId"]')?.value || '', pairKey: form?.querySelector('[name="pairKey"]')?.value || '' }; render({ focusDialog: true }); return }
  if (action === 'help') { openDialog('help'); return }
  if (action === 'evidence-info') { openDialog('evidence'); return }
  if (action === 'retry-accreditation') { await loadAccreditationOverview(); return }
  if (action === 'accreditation-home') { ui.accreditation.view = 'overview'; ui.accreditation.requirement = null; ui.accreditation.setup.error = ''; render(); return }
  if (action === 'accreditation-explore') { ui.accreditation.view = 'explore'; ui.accreditation.exploreStep = 0; render(); return }
  if (action === 'accreditation-exit-explore') { ui.accreditation.view = 'overview'; ui.accreditation.exploreStep = 0; render(); return }
  if (action === 'accreditation-explore-next') { ui.accreditation.exploreStep = Math.min(4, Number(ui.accreditation.exploreStep || 0) + 1); render(); return }
  if (action === 'accreditation-explore-prev') { ui.accreditation.exploreStep = Math.max(0, Number(ui.accreditation.exploreStep || 0) - 1); render(); return }
  if (action === 'accreditation-start-setup') {
    ui.accreditation.view = 'setup'
    ui.accreditation.setup = {
      step: 1,
      values: {
        journeyStatus: 'NOT_SURE',
        assessmentScheduled: 'UNKNOWN',
        targetAssessmentDate: '',
        accreditingAgencyId: '',
        stateOrTerritory: '',
        practiceType: '',
        locationsCount: '',
        gpCount: '',
        nursingWorkforce: '',
        alliedHealth: '',
        adminWorkforce: '',
        vaccinations: 'UNKNOWN',
        procedures: 'UNKNOWN',
        telehealth: 'UNKNOWN',
        pathologyCollection: 'UNKNOWN',
        pointOfCareTesting: 'UNKNOWN',
        vaccineStorage: 'UNKNOWN',
        services: '',
        notes: '',
      },
      submitting: false,
      error: '',
      complete: false,
    }
    render()
    return
  }
  if (action === 'accreditation-setup-back') {
    ui.accreditation.setup = {
      ...ui.accreditation.setup,
      step: Math.max(1, Number(ui.accreditation.setup?.step || 1) - 1),
      error: '',
      complete: false,
    }
    render()
    return
  }
  if (action === 'accreditation-edit-practice-information') {
    if (!ui.accreditation.practiceInformation) await loadAccreditationPracticeInformation()
    ui.accreditation.view = 'practice-information'
    ui.accreditation.practiceInformationEditing = true
    ui.accreditation.practiceInformationError = ''
    render()
    return
  }
  if (action === 'accreditation-cancel-practice-information-edit') {
    ui.accreditation.practiceInformationEditing = false
    ui.accreditation.practiceInformationError = ''
    render()
    return
  }
  if (action === 'close-dialog') { closeDialog(); return }
  if (action === 'save-answer') { saveCurrentAnswer(actionEl.dataset.answerId); return }
  if (action === 'retry-question') { if (ui.failedQuestion) { const question = ui.failedQuestion; ui.failedQuestion = ''; ui.error = ''; await submitQuestion(question) } return }
  if (action === 'ask-accreditation') { navigate('/'); await submitQuestion('For accreditation, what certificates do I need from our doctors?'); return }
  if (action === 'create-document') { if (!appUser) { openDialog('login', { values: {}, submitting: false, serverError: 'Sign in to create and save practice documents.' }); return } openDialog('document', { templateId: null, values: defaultDocumentValues(), generated: false, draft: null, submitting: false, serverError: '' }); return }
  if (action === 'back-wizard') { ui.dialogData.generated = false; ui.dialogData.submitting = false; ui.dialogData.serverError = ''; render({focusDialog:true}); return }
  if (action === 'save-draft') { await savePolicyDraft(); return }
  if (action === 'download-document') { downloadPolicyDraft(); return }
  if (action === 'toggle-alert') { ui.openAlertId = ui.openAlertId === actionEl.dataset.alertId ? null : actionEl.dataset.alertId; render(); return }
  if (action === 'scroll-calendar') { document.querySelector('#demo-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
  if (action === 'start-trial') { openDialog('trial-request', { errors: {}, values: defaultLeadValues() }); return }
  if (action === 'confirm-demo') { confirmDemo(); return }
  if (action === 'toggle-password') {
    const input = actionEl.closest('.password-wrap')?.querySelector('input')
    if (input) input.type = input.type === 'password' ? 'text' : 'password'
    return
  }
  if (action === 'terms' || action === 'privacy') { event.preventDefault(); showToast('Legal links will connect to MediQo policy pages'); return }
  if (action === 'reset-prototype') {
    if (confirm('Reset local MediQo data in this browser?')) {
      resetPrototypeState(); prototype = loadPrototypeState(); ui.chat = null; ui.conversationId = null; ui.conversationTurns = []; ui.pendingTurn = null; ui.failedQuestion = ''; ui.userMenuOpen = false; render(); showToast('Local data reset')
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
  if (form.matches('[data-login-form]')) {
    event.preventDefault(); await handleLogin(form); return
  }
  if (form.matches('[data-trial-request-form]')) {
    event.preventDefault(); await handleTrialRequest(form); return
  }
  if (form.matches('[data-feature-request-form]')) {
    event.preventDefault(); await handleFeatureRequest(form); return
  }
  if (form.matches('[data-document-form]')) {
    event.preventDefault(); await handleDocumentForm(form); return
  }
  if (form.matches('[data-accreditation-setup-form]')) {
    event.preventDefault(); await handleAccreditationSetupForm(form); return
  }
  if (form.matches('[data-accreditation-practice-information-form]')) {
    event.preventDefault(); await handleAccreditationPracticeInformationForm(form); return
  }
})

root.addEventListener('input', (event) => {
  const textarea = event.target.closest('.chat-composer textarea')
  if (textarea) {
    const count = textarea.closest('.chat-composer')?.querySelector('.char-count')
    if (count) count.textContent = `${textarea.value.length}/500`
  }
})

root.addEventListener('keydown', async (event) => {
  const requirementRow = event.target.closest('tr[data-accreditation-requirement]')
  if (requirementRow && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    await openAccreditationRequirement(requirementRow.dataset.accreditationRequirement)
    return
  }
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
  if (ui.path === '/accreditation' && appUser) void loadAccreditationOverview()
  if (ui.path === '/policies' && appUser) void loadPolicyDocuments()
})

render()
void bootstrapAuth()
