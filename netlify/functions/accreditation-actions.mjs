import { authenticateUser, createSupabaseServer } from './_shared/supabase-server.mjs'
import { jsonResponse, parseJsonBody } from './_shared/http.mjs'

const PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'])
const RECOMMENDED_ACTION_CODES = new Set([
  'CONFIRMED_GAP',
  'NEEDS_ATTENTION',
  'EVIDENCE_OUTDATED',
  'EVIDENCE_INCOMPLETE',
  'EVIDENCE_CONFLICTING',
  'EVIDENCE_MORE_INFORMATION_REQUIRED',
  'EVIDENCE_REVIEW_PENDING',
  'MISSING_POLICY',
  'MISSING_EVIDENCE',
  'RECHECK_REQUIRED',
])

function header(event, name) {
  const headers = event?.headers || {}
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || ''
}

function cleanText(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max)
}

function cleanDate(value) {
  const date = cleanText(value, 10)
  if (!date) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid_due_date')
  return date
}

function normalizeCreateItem(item = {}) {
  const title = cleanText(item.title, 200)
  if (title.length < 2) throw new Error('action_title_required')
  const priority = cleanText(item.priority || 'MEDIUM', 20).toUpperCase()
  const status = cleanText(item.status || 'OPEN', 20).toUpperCase()
  if (!PRIORITIES.has(priority)) throw new Error('invalid_priority')
  if (!STATUSES.has(status)) throw new Error('invalid_status')
  return {
    title,
    description: cleanText(item.description, 4000),
    priority,
    status,
    ownerUserId: cleanText(item.ownerUserId, 80) || null,
    dueDate: cleanDate(item.dueDate),
    requirementId: cleanText(item.requirementId, 120) || null,
    evidenceId: cleanText(item.evidenceId, 80) || null,
    sourceReason: cleanText(item.sourceReason, 1000),
    completionNote: cleanText(item.completionNote, 2000),
  }
}

function isRecommendedActionCandidate(item = {}) {
  if (!item.requirementId) return false
  const issueCodes = Array.isArray(item.issueCodes) ? item.issueCodes : []
  return issueCodes.some((code) => RECOMMENDED_ACTION_CODES.has(String(code || '').toUpperCase()))
}

function recommendedActionItem(item = {}) {
  const indicator = cleanText(item.indicator, 40)
  const title = cleanText(item.title, 140) || 'Accreditation follow-up'
  return normalizeCreateItem({
    title: indicator ? `Address ${indicator} — ${title}` : `Address ${title}`,
    description: cleanText(item.nextAction, 4000),
    priority: item.priority || 'MEDIUM',
    status: 'OPEN',
    ownerUserId: null,
    dueDate: null,
    requirementId: item.requirementId,
    evidenceId: null,
    sourceReason: cleanText(item.whyShown, 1000),
    completionNote: '',
  })
}

function normalizePatch(patch = {}) {
  const normalized = {}
  if ('title' in patch) {
    const title = cleanText(patch.title, 200)
    if (title.length < 2) throw new Error('action_title_required')
    normalized.title = title
  }
  if ('description' in patch) normalized.description = cleanText(patch.description, 4000)
  if ('priority' in patch) {
    const priority = cleanText(patch.priority, 20).toUpperCase()
    if (!PRIORITIES.has(priority)) throw new Error('invalid_priority')
    normalized.priority = priority
  }
  if ('status' in patch) {
    const status = cleanText(patch.status, 20).toUpperCase()
    if (!STATUSES.has(status)) throw new Error('invalid_status')
    normalized.status = status
  }
  if ('ownerUserId' in patch) normalized.ownerUserId = cleanText(patch.ownerUserId, 80) || null
  if ('dueDate' in patch) normalized.dueDate = cleanDate(patch.dueDate)
  if ('requirementId' in patch) normalized.requirementId = cleanText(patch.requirementId, 120) || null
  if ('sourceReason' in patch) normalized.sourceReason = cleanText(patch.sourceReason, 1000)
  if ('completionNote' in patch) normalized.completionNote = cleanText(patch.completionNote, 2000)
  return normalized
}

export function createAccreditationActionsHandler({
  env = process.env,
  authenticate = ({ authorization }) => authenticateUser({ authorization, env }),
  createServer = () => createSupabaseServer({ env }),
} = {}) {
  return async function handler(event = {}) {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'POST') {
      return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' }, { Allow: 'POST' })
    }

    let body
    try {
      body = parseJsonBody(event)
    } catch {
      return jsonResponse(400, { code: 'invalid_json', message: 'Request body must be valid JSON.' })
    }

    const authorization = header(event, 'authorization')
    if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) {
      return jsonResponse(401, { code: 'authentication_required', message: 'Sign in to manage accreditation actions.' })
    }

    let actor
    try {
      actor = await authenticate({ authorization })
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) actor = null
      else {
        console.error('MediQo accreditation actions auth failed:', error?.message || error)
        return jsonResponse(500, { code: 'auth_error', message: 'Could not validate the MediQo session.' })
      }
    }
    if (!actor?.userId || !actor?.practiceId) {
      return jsonResponse(401, { code: 'invalid_session', message: 'Your MediQo session is no longer valid. Please sign in again.' })
    }

    let server
    try {
      server = createServer()
    } catch (error) {
      console.error('MediQo accreditation actions setup failed:', error?.message || error)
      return jsonResponse(500, { code: 'server_not_configured', message: 'MediQo accreditation action services are not configured.' })
    }

    try {
      const cycle = await server.getOrCreateAccreditationCycle(actor.practiceId, body.cycleId || null)
      const action = cleanText(body.action, 30)

      if (action === 'list') {
        const actions = await server.listAccreditationActions({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          today: cleanDate(body.localDate) || undefined,
        })
        return jsonResponse(200, { actions, cycleId: cycle.id })
      }

      if (action === 'create') {
        const item = normalizeCreateItem(body.item || {})
        const created = await server.createAccreditationAction({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          createdByUserId: actor.userId,
          item,
        })
        return jsonResponse(200, { action: created, cycleId: cycle.id })
      }

      if (action === 'create_recommended') {
        const missing = await server.getAccreditationMissing({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
        })
        const candidates = (Array.isArray(missing?.items) ? missing.items : [])
          .filter(isRecommendedActionCandidate)

        let created = 0
        let skipped = 0
        for (const candidate of candidates) {
          if (candidate.actionId) {
            skipped += 1
            continue
          }
          try {
            await server.createAccreditationAction({
              practiceId: actor.practiceId,
              cycleId: cycle.id,
              createdByUserId: actor.userId,
              item: recommendedActionItem(candidate),
            })
            created += 1
          } catch (error) {
            if (String(error?.message || '') === 'accreditation_action_already_exists') {
              skipped += 1
              continue
            }
            throw error
          }
        }

        return jsonResponse(200, {
          result: { eligible: candidates.length, created, skipped },
          cycleId: cycle.id,
        })
      }

      if (action === 'update') {
        const actionId = cleanText(body.actionId, 80)
        if (!actionId) return jsonResponse(400, { code: 'action_id_required', message: 'Action ID is required.' })
        const patch = normalizePatch(body.patch || {})
        if (!Object.keys(patch).length) return jsonResponse(400, { code: 'action_patch_required', message: 'Choose something to update.' })
        const updated = await server.updateAccreditationAction({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          actionId,
          updatedByUserId: actor.userId,
          patch,
        })
        return jsonResponse(200, { action: updated, cycleId: cycle.id })
      }

      return jsonResponse(400, { code: 'invalid_action', message: 'Choose list, create, create_recommended or update.' })
    } catch (error) {
      const message = String(error?.message || '')
      if (message === 'accreditation_cycle_not_found') {
        return jsonResponse(404, { code: 'cycle_not_found', message: 'Accreditation cycle was not found for this practice.' })
      }
      if (message === 'accreditation_action_not_found') {
        return jsonResponse(404, { code: 'action_not_found', message: 'Accreditation action was not found.' })
      }
      if (message === 'accreditation_action_owner_not_found') {
        return jsonResponse(400, { code: 'owner_not_found', message: 'Choose an active member of this practice as the owner.' })
      }
      if (message === 'accreditation_requirement_not_found') {
        return jsonResponse(400, { code: 'requirement_not_found', message: 'The linked accreditation requirement could not be found.' })
      }
      if (message === 'accreditation_action_already_exists') {
        return jsonResponse(409, { code: 'action_already_exists', message: 'An action is already linked to this requirement. Open the existing action instead.' })
      }
      if (message === 'action_title_required') {
        return jsonResponse(400, { code: 'title_required', message: 'Add an action title.' })
      }
      if (message === 'invalid_priority') {
        return jsonResponse(400, { code: 'invalid_priority', message: 'Choose Low, Medium, High or Critical priority.' })
      }
      if (message === 'invalid_status') {
        return jsonResponse(400, { code: 'invalid_status', message: 'Choose Open, In progress, Blocked or Done.' })
      }
      if (message === 'invalid_due_date') {
        return jsonResponse(400, { code: 'invalid_due_date', message: 'Choose a valid due date.' })
      }
      console.error('MediQo accreditation actions failed:', error?.message || error)
      return jsonResponse(500, { code: 'accreditation_actions_error', message: 'MediQo could not manage accreditation actions. Please try again.' })
    }
  }
}

export const handler = createAccreditationActionsHandler()
