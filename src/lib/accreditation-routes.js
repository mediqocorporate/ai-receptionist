const VIEW_PATHS = Object.freeze({
  overview: '/accreditation',
  check: '/accreditation/check',
  comprehensive: '/accreditation/comprehensive',
  requirements: '/accreditation/requirements',
  evidence: '/accreditation/evidence',
  missing: '/accreditation/missing',
  actions: '/accreditation/actions',
  'practice-information': '/accreditation/practice-information',
  explore: '/accreditation/explore',
  setup: '/accreditation/setup',
})

const PATH_VIEWS = new Map(Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]))

function normalizePath(pathname = '') {
  const value = String(pathname || '').trim() || '/'
  if (value === '/') return value
  return value.replace(/\/+$/, '') || '/'
}

export function accreditationPathForView(view = 'overview') {
  return VIEW_PATHS[String(view || 'overview')] || VIEW_PATHS.overview
}

export function accreditationRequirementPath(indicator = '') {
  const value = String(indicator || '').trim()
  if (!value) return VIEW_PATHS.requirements
  return `${VIEW_PATHS.requirements}/${encodeURIComponent(value)}`
}

export function parseAccreditationPath(pathname = '') {
  const path = normalizePath(pathname)
  const view = PATH_VIEWS.get(path)
  if (view) return { view, requirementIndicator: '' }

  const prefix = `${VIEW_PATHS.requirements}/`
  if (!path.startsWith(prefix)) return null
  const encoded = path.slice(prefix.length)
  if (!encoded || encoded.includes('/')) return null

  let requirementIndicator = ''
  try {
    requirementIndicator = decodeURIComponent(encoded).trim()
  } catch {
    return null
  }
  if (!requirementIndicator) return null
  return { view: 'requirement', requirementIndicator }
}
