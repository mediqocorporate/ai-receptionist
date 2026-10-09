const JOURNEY_STATUSES = new Set(['FIRST_ACCREDITATION', 'REACCREDITATION', 'CURRENTLY_ACCREDITED', 'ASSESSMENT_BOOKED', 'NOT_SURE'])
const STATES = new Set(['NSW', 'VIC', 'QLD', 'ACT', 'WA', 'SA', 'NT', 'TAS'])
const TRI_STATE = new Set(['YES', 'NO', 'UNKNOWN'])

function cleanString(value, max = 500) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, max) : ''
}

function cleanCount(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 10000 ? number : null
}

function cleanTriState(value) {
  const candidate = String(value ?? 'UNKNOWN').trim().toUpperCase()
  return TRI_STATE.has(candidate) ? candidate : 'UNKNOWN'
}

export function sanitizeAccreditationPracticeContext(rawContext = {}) {
  const source = rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext) ? rawContext : {}
  const stateCandidate = String(source.stateOrTerritory ?? '').trim().toUpperCase()
  return {
    stateOrTerritory: STATES.has(stateCandidate) ? stateCandidate : '',
    practiceType: cleanString(source.practiceType, 200),
    locationsCount: cleanCount(source.locationsCount),
    gpCount: cleanCount(source.gpCount),
    nursingWorkforce: cleanCount(source.nursingWorkforce),
    alliedHealth: cleanCount(source.alliedHealth),
    adminWorkforce: cleanCount(source.adminWorkforce),
    vaccinations: cleanTriState(source.vaccinations),
    procedures: cleanTriState(source.procedures),
    telehealth: cleanTriState(source.telehealth),
    pathologyCollection: cleanTriState(source.pathologyCollection),
    pointOfCareTesting: cleanTriState(source.pointOfCareTesting),
    vaccineStorage: cleanTriState(source.vaccineStorage),
    services: cleanString(source.services, 2000),
    notes: cleanString(source.notes, 4000),
  }
}

export function normalizeAccreditationSetup(body = {}) {
  const journeyCandidate = String(body.journeyStatus ?? '').trim()
  const journeyStatus = JOURNEY_STATUSES.has(journeyCandidate) ? journeyCandidate : 'NOT_SURE'
  const assessmentScheduled = body.assessmentScheduled === true ? true : body.assessmentScheduled === false ? false : null
  const rawDate = cleanString(body.targetAssessmentDate, 20)
  const targetAssessmentDate = assessmentScheduled === true && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null
  return {
    journeyStatus,
    assessmentScheduled,
    targetAssessmentDate,
    accreditingAgencyId: cleanString(body.accreditingAgencyId, 200) || null,
    practiceContext: sanitizeAccreditationPracticeContext(body.practiceContext),
  }
}

function provenance(value, explicit = 'Accreditation setup') {
  if (value === null || value === undefined || value === '') return 'Not provided'
  if (Array.isArray(value) && value.length === 0) return 'Not provided'
  return explicit
}

export function buildAccreditationPracticeInformation({ practice = null, profile = null, cycle = null, agencies = [] } = {}) {
  const context = sanitizeAccreditationPracticeContext(profile?.practice_context || {})
  const agencyList = Array.isArray(agencies) ? agencies : []
  const agency = agencyList.find((item) => item.id === profile?.accrediting_agency_id) || null
  const accountState = Array.isArray(practice?.jurisdictions) && practice.jurisdictions.length ? practice.jurisdictions[0] : ''
  const state = context.stateOrTerritory || accountState || ''
  const practiceType = context.practiceType || practice?.practice_type || ''
  const targetAssessmentDate = cycle?.target_assessment_date || ''

  return {
    facts: [
      { key: 'practice_name', label: 'Practice name', value: practice?.name || null, provenance: provenance(practice?.name, 'MediQo account') },
      { key: 'state_or_territory', label: 'State / territory', value: state || null, provenance: context.stateOrTerritory ? 'Accreditation setup' : provenance(accountState, 'MediQo account') },
      { key: 'practice_type', label: 'Practice type', value: practiceType || null, provenance: context.practiceType ? 'Accreditation setup' : provenance(practice?.practice_type, 'MediQo account') },
      { key: 'journey_status', label: 'Accreditation journey', value: profile?.journey_status || null, provenance: provenance(profile?.journey_status) },
      { key: 'assessment_date', label: 'Next assessment date', value: targetAssessmentDate || null, provenance: provenance(targetAssessmentDate) },
      { key: 'accrediting_agency', label: 'Accrediting agency', value: agency?.name || null, provenance: provenance(agency?.name) },
      { key: 'locations_count', label: 'Number of locations', value: context.locationsCount, provenance: provenance(context.locationsCount) },
      { key: 'gp_count', label: 'Number of GPs', value: context.gpCount, provenance: provenance(context.gpCount) },
      { key: 'nursing_workforce', label: 'Nursing workforce', value: context.nursingWorkforce, provenance: provenance(context.nursingWorkforce) },
      { key: 'allied_health', label: 'Allied health workforce', value: context.alliedHealth, provenance: provenance(context.alliedHealth) },
      { key: 'admin_workforce', label: 'Reception / admin workforce', value: context.adminWorkforce, provenance: provenance(context.adminWorkforce) },
      { key: 'vaccinations', label: 'Vaccinations', value: context.vaccinations, provenance: provenance(context.vaccinations) },
      { key: 'procedures', label: 'Procedures', value: context.procedures, provenance: provenance(context.procedures) },
      { key: 'telehealth', label: 'Telehealth', value: context.telehealth, provenance: provenance(context.telehealth) },
      { key: 'pathology_collection', label: 'Pathology collection', value: context.pathologyCollection, provenance: provenance(context.pathologyCollection) },
      { key: 'point_of_care_testing', label: 'Point-of-care testing', value: context.pointOfCareTesting, provenance: provenance(context.pointOfCareTesting) },
      { key: 'vaccine_storage', label: 'Vaccine storage', value: context.vaccineStorage, provenance: provenance(context.vaccineStorage) },
      { key: 'services', label: 'Services / practice context', value: context.services || null, provenance: provenance(context.services) },
      { key: 'notes', label: 'Additional practice context', value: context.notes || null, provenance: provenance(context.notes) },
    ],
    values: {
      journeyStatus: profile?.journey_status || 'NOT_SURE',
      assessmentScheduled: profile?.assessment_scheduled === true ? 'YES' : profile?.assessment_scheduled === false ? 'NO' : 'UNKNOWN',
      targetAssessmentDate,
      accreditingAgencyId: profile?.accrediting_agency_id || '',
      ...context,
      stateOrTerritory: state,
      practiceType,
    },
    agencies: agencyList.map(({ id, name }) => ({ id, name })),
  }
}
