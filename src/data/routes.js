export const APP_ROUTES = [
  { id: 'ask', label: 'Ask a Question', path: '/', icon: 'message-circle' },
  { id: 'accreditation', label: 'Accreditation Assistant', path: '/accreditation', icon: 'shield-check' },
  { id: 'policies', label: 'Policy Library', path: '/policies', icon: 'file-text' },
]

export const ACCREDITATION_SUBROUTES = [
  { view: 'overview', label: 'Overview', available: true },
  { view: 'check', label: 'Quick Check', available: true },
  { view: 'comprehensive', label: 'Comprehensive Check', available: true },
  { view: 'requirements', label: 'Requirements', available: true },
  { view: 'evidence', label: 'Evidence', available: false },
  { view: 'missing', label: "What's Missing", available: false },
  { view: 'actions', label: 'Actions', available: false },
  { view: 'team', label: 'Team', available: false },
  { view: 'assistant', label: 'Ask Accreditation Assistant', available: false },
  { view: 'report', label: 'Readiness Report', available: false },
  { view: 'practice-information', label: 'Practice Information', available: true },
]

export const PRODUCT_ROUTES = [
  { id: 'ai-receptionist', label: 'AI Receptionist', path: '/products/ai-receptionist', icon: 'phone' },
  { id: 'scribe', label: 'Scribe', path: '/products/scribe', icon: 'notebook' },
  { id: 'document-sorter', label: 'Document Sorter', path: '/products/document-sorter', icon: 'inbox' },
  { id: 'care-plan-generation', label: 'Care Plan Generation', path: '/products/care-plan-generation', icon: 'users' },
  { id: 'mbs-billing-suggestions', label: 'MBS Billing Suggestions', path: '/products/mbs-billing-suggestions', icon: 'circle-dollar' },
  { id: 'telehealth', label: 'Telehealth', path: '/products/telehealth', icon: 'video' },
  { id: 'online-bookings', label: 'Online Bookings', path: '/products/online-bookings', icon: 'calendar' },
]

export function routeTitle(pathname) {
  if (pathname === '/alerts') return 'Alerts Centre'
  const all = [...APP_ROUTES, ...PRODUCT_ROUTES]
  return all.find((route) => route.path === pathname)?.label || 'Ask a Question'
}
