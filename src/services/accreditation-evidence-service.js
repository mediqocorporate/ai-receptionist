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

export function validateEvidenceFiles(files) {
  const list = Array.from(files || [])
  if (list.length > MAX_EVIDENCE_BATCH_FILES) throw new Error('Upload up to 50 files in one batch.')
  list.forEach(validateFile)
  return list
}

function signedUploadUrl(upload, config) {
  const raw = String(upload?.signedUrl || '').trim()
  const base = String(config?.supabaseUrl || '').trim().replace(/\/+$/, '')
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw
    if (!base) return ''
    if (raw.startsWith('/storage/v1/')) return `${base}${raw}`
    return `${base}/storage/v1${raw.startsWith('/') ? '' : '/'}${raw}`
  }
  const token = String(upload?.token || '').trim()
  const bucket = String(upload?.bucket || 'accreditation-evidence').trim()
  const path = String(upload?.path || '').trim()
  if (!base || !token || !path) return ''
  const encodedPath = path.split('/').map((part) => encodeURIComponent(part)).join('/')
  return `${base}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath}?token=${encodeURIComponent(token)}`
}

function uploadSignedFileWithProgress({ url, file, xhrFactory, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory?.()
    if (!xhr) {
      reject(new Error('This browser could not start the evidence upload.'))
      return
    }
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (event) => {
      if (!event?.lengthComputable || !event.total) return
      onProgress?.(Math.max(0, Math.min(event.loaded, event.total)), event.total)
    }
    xhr.onerror = () => reject(new Error(`Could not upload ${file?.name || 'evidence'}.`))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      let message = `Could not upload ${file?.name || 'evidence'}.`
      try {
        const body = JSON.parse(String(xhr.responseText || '{}'))
        message = body?.message || body?.error || message
      } catch {}
      reject(new Error(message))
    }

    let body = file
    if (typeof globalThis.FormData !== 'undefined' && typeof globalThis.Blob !== 'undefined' && file instanceof globalThis.Blob) {
      body = new globalThis.FormData()
      body.append('cacheControl', '3600')
      body.append('', file)
    } else {
      xhr.setRequestHeader('cache-control', 'max-age=3600')
      if (file?.type) xhr.setRequestHeader('content-type', file.type)
    }
    xhr.send(body)
  })
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
  xhrFactory = typeof globalThis.XMLHttpRequest === 'function' ? () => new globalThis.XMLHttpRequest() : null,
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

  async function uploadOne({
    cycleId,
    file,
    category = 'OTHER',
    requirementId = '',
    onProgress,
    completedBytes = 0,
    totalBytes = Number(file?.size || 0),
    currentFileIndex = 1,
    totalFiles = 1,
  }) {
    validateFile(file)
    const fileSize = Number(file.size || 0)
    const report = (fileLoaded, finalized = false) => {
      if (typeof onProgress !== 'function') return
      const loadedBytes = Math.max(0, Math.min(totalBytes, completedBytes + Math.min(fileSize, Math.max(0, fileLoaded))))
      let percent = totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : 0
      if (!finalized && loadedBytes >= totalBytes) percent = 99
      onProgress({
        percent,
        loadedBytes,
        totalBytes,
        currentFileIndex,
        totalFiles,
        currentFilename: String(file.name || ''),
      })
    }

    report(0)
    const prepared = await request({
      action: 'prepareUpload',
      cycleId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      category,
    })
    const upload = prepared?.upload || {}
    const uploadUrl = signedUploadUrl(upload, config)
    if (xhrFactory && uploadUrl) {
      await uploadSignedFileWithProgress({
        url: uploadUrl,
        file,
        xhrFactory,
        onProgress: (loaded, eventTotal) => {
          const fileLoaded = eventTotal ? Math.round((loaded / eventTotal) * fileSize) : loaded
          report(fileLoaded)
        },
      })
    } else {
      const { client } = await bearerToken(clientProvider)
      const { error } = await client.storage
        .from(upload.bucket || 'accreditation-evidence')
        .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type, upsert: false })
      if (error) throw new Error(error.message || `Could not upload ${file.name}.`)
    }

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
    report(fileSize, true)
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

    validateFiles(files) {
      return validateEvidenceFiles(files)
    },

    async upload({ cycleId, file, category = 'OTHER', requirementId = '', onProgress }) {
      return uploadOne({ cycleId, file, category, requirementId, onProgress })
    },

    async uploadBatch({ cycleId, files, category = 'OTHER', requirementId = '', onProgress }) {
      const list = validateEvidenceFiles(files)
      if (!list.length) throw new Error('Choose at least one evidence file.')
      const totalBytes = list.reduce((sum, file) => sum + Number(file?.size || 0), 0)
      const uploaded = []
      let completedBytes = 0
      for (let index = 0; index < list.length; index += 1) {
        const file = list[index]
        uploaded.push(await uploadOne({
          cycleId,
          file,
          category,
          requirementId,
          onProgress,
          completedBytes,
          totalBytes,
          currentFileIndex: index + 1,
          totalFiles: list.length,
        }))
        completedBytes += Number(file?.size || 0)
      }
      return uploaded
    },

    async link({ cycleId, evidenceId, requirementId }) {
      const body = await request({ action: 'link', cycleId, evidenceId, requirementId })
      return body.link
    },

    async review({
      cycleId,
      evidenceId,
      requirementId,
      reviewStatus,
      reason,
      recommendedAction = '',
    }) {
      const body = await request({
        action: 'review',
        cycleId,
        evidenceId,
        requirementId,
        reviewStatus,
        reason,
        recommendedAction,
      })
      return body.assessment
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
