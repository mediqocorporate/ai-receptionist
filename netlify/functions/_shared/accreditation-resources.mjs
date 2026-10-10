const RACGP_STANDARDS_BASE = 'https://www.racgp.org.au/running-a-practice/practice-standards/standards-5th-edition/standards-for-general-practices-5th-ed'

function slug(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function racgpCriterionResource(requirement = {}) {
  const criterion = String(requirement.criterion || '').trim().toUpperCase()
  const description = String(requirement.criterionDescription || '').trim()
  if (!criterion || !description) return null

  let modulePath = ''
  if (/^C\d+\.\d+$/.test(criterion)) {
    const number = criterion.match(/^C(\d+)/)?.[1] || ''
    modulePath = `core-standards/core-standard-${number}`
  } else if (/^QI\d+\.\d+$/.test(criterion)) {
    const number = criterion.match(/^QI(\d+)/)?.[1] || ''
    modulePath = `qi-standards/qi-standard-${number}`
  } else if (/^GP\d+\.\d+$/.test(criterion)) {
    const number = criterion.match(/^GP(\d+)/)?.[1] || ''
    modulePath = `general-practice-standards/gp-standard-${number}`
  }
  if (!modulePath) return null

  return {
    id: `RACGP-${criterion}`,
    publisher: 'RACGP',
    title: `Criterion ${criterion} – ${description}`,
    url: `${RACGP_STANDARDS_BASE}/${modulePath}/criterion-${slug(criterion)}-${slug(description)}`,
    usedFor: `RACGP Criterion ${criterion} content`,
    verification: 'Official RACGP 5th Edition criterion page',
  }
}

export function buildAccreditationResources(context = {}, sources = []) {
  const criterionResources = []
  const seen = new Set()
  for (const requirement of Array.isArray(context.requirements) ? context.requirements : []) {
    const resource = racgpCriterionResource(requirement)
    if (!resource || seen.has(resource.id)) continue
    seen.add(resource.id)
    criterionResources.push(resource)
  }

  const globalSources = (Array.isArray(sources) ? sources : [])
    .filter((source) => !(criterionResources.length && String(source?.id || '') === 'SRC-001'))

  return [...criterionResources, ...globalSources]
}
