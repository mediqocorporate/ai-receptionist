import { integrationConfig } from './integration-config.js'
import { getSupabaseClient } from './supabase-client.js'

export const MAX_EVIDENCE_BATCH_FILES = 50
export const MAX_EVIDENCE_FILE_BYTES = 25 * 1024 * 1024

const MIME_BY_EXTENSION = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
})

function validateFile(file) {
  const name = String(file?.name || '')
  const type = String(file?.type || '').toLowerCase()
  const size = Number(file?.size || 0)
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
  const expected = MIME_BY_EXTENSION[extension]
  if (!expected || expected !== type) throw new Error(`${name || 'This file'} is not a supported evidence file. Use PDF, DOCX, XLSX, CSV, JPG, JPEG or PNG.`)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_EVIDENCE_FILE_BYTES) throw new Error(`${name || 'This file'} must be 25 MB or smaller.`)
}

async function bearerToken(clientProvider) {
  const client = await clientProvider()
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(error.message || 'Could not read your MediQo session.')
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in to manage accreditation evidence.')
  return { client, token }
}

export function createAccreditationEvidenceService({
  config = integrationConfig,
  clientProvider = getSupabaseClient,
  fetchImpl = fetch,
} = {}) {
  const endpoint = String(config.accreditationEvidenceApiUrl || '/api/accreditation-evidence').trim()

  async function request(payload) {
    if (!endpoint) throw new Error('MediQo evidence services are not configured yet.')
    const { token } = await bearerToken(clientProvider)
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(body?.message || 'MediQo could not manage accreditation evidence. Please try again.')
      error.code = body?.code || 'accreditation_evidence_error'
      error.status = response.status
      throw error
    }
    return body
  }

  async function uploadOne({ cycleId, file, category = 'OTHER', requirementId = '' }) {
    validateFile(file)
    const prepared = await request({
      action: 'prepareUpload',
      cycleId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      category,
    })
    const { client } = await bearerToken(clientProvider)
    const upload = prepared?.upload || {}
    const { error } = await client.storage
      .from(upload.bucket || 'accreditation-evidence')
      .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(error.message || `Could not upload ${file.name}.`)

    const finalized = await request({
      action: 'finalizeUpload',
      cycleId,
      evidenceId: prepared.evidence?.id,
      title: String(file.name || 'Evidence').replace(/\.[^.]+$/, ''),
    })
    if (requirementId && finalized?.evidence?.id) {
      await request({
        action: 'link',
        cycleId,
        evidenceId: finalized.evidence.id,
        requirementId,
      })
    }
    return finalized.evidence
  }

  return {
    isLive() {
      return Boolean(endpoint)
    },

    async list({ cycleId }) {
      const body = await request({ action: 'list', cycleId })
      return Array.isArray(body.evidence) ? body.evidence : []
    },

    async upload({ cycleId, file, category = 'OTHER', requirementId = '' }) {
      return uploadOne({ cycleId, file, category, requirementId })
    },

    async uploadBatch({ cycleId, files, category = 'OTHER', requirementId = '' }) {
      const list = Array.from(files || [])
      if (!list.length) throw new Error('Choose at least one evidence file.')
      if (list.length > MAX_EVIDENCE_BATCH_FILES) throw new Error('Upload up to 50 files in one batch.')
      list.forEach(validateFile)
      const uploaded = []
      for (const file of list) uploaded.push(await uploadOne({ cycleId, file, category, requirementId }))
      return uploaded
    },

    async link({ cycleId, evidenceId, requirementId }) {
      const body = await request({ action: 'link', cycleId, evidenceId, requirementId })
      return body.link
    },

    async supersede({ cycleId, evidenceId }) {
      return request({ action: 'supersede', cycleId, evidenceId })
    },

    async download({ cycleId, evidenceId }) {
      const body = await request({ action: 'download', cycleId, evidenceId })
      return body.download
    },
  }
}

export const accreditationEvidenceService = createAccreditationEvidenceService()
