const STORAGE_KEY = 'mediqo.prototype.state'
const COOKIE_KEY = 'mediqo_qcount'

export function createDefaultState(visitorId = createVisitorId()) {
  return {
    visitorId,
    freeQuestionCount: 0,
    user: null,
    savedAnswerIds: [],
    questionHistory: [],
    questionLog: [],
    selectedPractice: 'Riverside Medical Centre',
    accreditationOverrides: {},
    sidebarCollapsed: false,
  }
}

function createVisitorId() {
  const suffix = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return `mq_${suffix}`
}

function parseCookieCount(cookieText = '') {
  const match = String(cookieText).match(new RegExp(`(?:^|;\\s*)${COOKIE_KEY}=(\\d+)`))
  return match ? Number(match[1]) : 0
}

export function loadPrototypeState(storage = globalThis.localStorage, cookieText = globalThis.document?.cookie || '') {
  let state
  try {
    const raw = storage?.getItem?.(STORAGE_KEY)
    state = raw ? { ...createDefaultState(), ...JSON.parse(raw) } : createDefaultState()
  } catch {
    state = createDefaultState()
  }
  const cookieCount = parseCookieCount(cookieText)
  state.freeQuestionCount = Math.max(Number(state.freeQuestionCount) || 0, cookieCount)
  if (!Array.isArray(state.savedAnswerIds)) state.savedAnswerIds = []
  if (!Array.isArray(state.questionHistory)) state.questionHistory = []
  if (!Array.isArray(state.questionLog)) state.questionLog = []
  if (!state.accreditationOverrides || typeof state.accreditationOverrides !== 'object') state.accreditationOverrides = {}
  state.sidebarCollapsed = false
  return state
}

export function savePrototypeState(state, storage = globalThis.localStorage, doc = globalThis.document) {
  const { sidebarCollapsed: _sidebarCollapsed, ...persistentState } = state
  storage?.setItem?.(STORAGE_KEY, JSON.stringify(persistentState))
  if (doc) doc.cookie = `${COOKIE_KEY}=${Math.max(0, Number(state.freeQuestionCount) || 0)}; path=/; max-age=31536000; SameSite=Lax`
  return state
}

export function resetPrototypeState(storage = globalThis.localStorage, doc = globalThis.document) {
  storage?.removeItem?.(STORAGE_KEY)
  if (doc) doc.cookie = `${COOKIE_KEY}=0; path=/; max-age=0; SameSite=Lax`
}

export const persistenceKeys = { STORAGE_KEY, COOKIE_KEY }
