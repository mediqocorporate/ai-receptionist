import { authenticateUser, createSupabaseServer } from './_shared/supabase-server.mjs'
import { jsonResponse, parseJsonBody } from './_shared/http.mjs'

export const MAX_EVIDENCE_FILE_BYTES = 25 * 1024 * 1024

const CATEGORY_VALUES = new Set([
  'POLICY_PROCEDURE',
  'REGISTER',
  'TRAINING_CREDENTIAL',
  'CERTIFICATE',
  'AUDIT_REPORT',
  'MEETING_RECORD',
  'EQUIPMENT_MAINTENANCE',
  'PATIENT_FEEDBACK',
  'OTHER',
])

const TYPE_BY_EXTENSION = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
})

function header(event, name) {
  const headers = event?.headers || {}
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || ''
}

function validateEvidenceFile({ filename, mimeType, sizeBytes }) {
  const name = String(filename || '').trim()
  const type = String(mimeType || '').trim().toLowerCase()
  const size = Number(sizeBytes)
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
  const expectedType = TYPE_BY_EXTENSION[extension]
  if (!name || !expectedType || expectedType !== type) {
    const error = new Error('Choose a PDF, DOCX, XLSX, CSV, JPG, JPEG or PNG file.')
    error.code = 'unsupported_evidence_file'
    error.status = 400
    throw error
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_EVIDENCE_FILE_BYTES) {
    const error = new Error('Each evidence file must be 25 MB or smaller.')
    error.code = 'evidence_file_too_large'
    error.status = 400
    throw error
  }
  return { filename: name, mimeType: expectedType, sizeBytes: size }
}

export function createAccreditationEvidenceHandler({
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

    let actor
    try {
      actor = await authenticate({ authorization: header(event, 'authorization') })
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) actor = null
      else return jsonResponse(500, { code: 'auth_error', message: 'Could not validate the MediQo session.' })
    }
    if (!actor) return jsonResponse(401, { code: 'invalid_session', message: 'Sign in to manage accreditation evidence.' })

    const cycleId = String(body.cycleId || '').trim()
    if (!cycleId) return jsonResponse(400, { code: 'cycle_required', message: 'An active accreditation cycle is required.' })

    let server
    try {
      server = createServer()
      const cycle = await server.getOrCreateAccreditationCycle(actor.practiceId, cycleId)
      if (!cycle?.id) throw new Error('accreditation_cycle_not_found')

      if (body.action === 'list') {
        const evidence = await server.listAccreditationEvidence({ practiceId: actor.practiceId, cycleId: cycle.id })
        return jsonResponse(200, { evidence })
      }

      if (body.action === 'prepareUpload') {
        const file = validateEvidenceFile(body)
        const category = CATEGORY_VALUES.has(String(body.category || '')) ? String(body.category) : 'OTHER'
        const result = await server.prepareAccreditationEvidenceUpload({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          userId: actor.userId,
          originalFilename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          category,
        })
        return jsonResponse(200, result)
      }

      if (body.action === 'finalizeUpload') {
        const evidenceId = String(body.evidenceId || '').trim()
        if (!evidenceId) return jsonResponse(400, { code: 'evidence_required', message: 'Evidence id is required.' })
        const evidence = await server.finalizeAccreditationEvidenceUpload({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          evidenceId,
          title: String(body.title || 'Evidence').trim() || 'Evidence',
          description: String(body.description || '').trim(),
          documentDate: body.documentDate || null,
          reviewDate: body.reviewDate || null,
          notes: String(body.notes || '').trim(),
        })
        return jsonResponse(200, { evidence })
      }

      if (body.action === 'link') {
        const evidenceId = String(body.evidenceId || '').trim()
        const requirementId = String(body.requirementId || '').trim()
        if (!evidenceId || !requirementId) return jsonResponse(400, { code: 'mapping_required', message: 'Choose evidence and a requirement to map.' })
        const link = await server.linkAccreditationEvidence({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          evidenceId,
          requirementId,
        })
        return jsonResponse(200, { link })
      }

      if (body.action === 'supersede') {
        const evidenceId = String(body.evidenceId || '').trim()
        if (!evidenceId) return jsonResponse(400, { code: 'evidence_required', message: 'Evidence id is required.' })
        const result = await server.supersedeAccreditationEvidence({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          evidenceId,
        })
        return jsonResponse(200, result)
      }

      if (body.action === 'download') {
        const evidenceId = String(body.evidenceId || '').trim()
        if (!evidenceId) return jsonResponse(400, { code: 'evidence_required', message: 'Evidence id is required.' })
        const download = await server.createAccreditationEvidenceDownload({
          practiceId: actor.practiceId,
          cycleId: cycle.id,
          evidenceId,
        })
        return jsonResponse(200, { download })
      }

      return jsonResponse(400, { code: 'unknown_action', message: 'Unknown evidence action.' })
    } catch (error) {
      console.error('MediQo accreditation evidence failed:', error?.message || error)
      const status = Number(error?.status || 500)
      const safeStatus = status >= 400 && status < 600 ? status : 500
      const known = String(error?.message || '')
      const message = safeStatus < 500 && known ? known : 'MediQo could not complete that evidence action. Please try again.'
      return jsonResponse(safeStatus, { code: error?.code || 'accreditation_evidence_error', message })
    }
  }
}

export const handler = createAccreditationEvidenceHandler()
