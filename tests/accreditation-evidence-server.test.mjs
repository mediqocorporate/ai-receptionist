import test from 'node:test'
import assert from 'node:assert/strict'
import { createSupabaseServer } from '../netlify/functions/_shared/supabase-server.mjs'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

test('prepare evidence upload inserts tenant metadata and requests a signed upload for a server-generated safe path', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const body = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : null
    calls.push({ url, method: options.method || 'GET', body })
    if (url.includes('/rest/v1/accreditation_evidence')) {
      return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', storage_path: body?.[0]?.storage_path, status: 'ACTIVE', processing_status: 'NOT_REVIEWED' }])
    }
    if (url.includes('/storage/v1/object/upload/sign/accreditation-evidence/')) {
      return json({ url: '/object/upload/sign/accreditation-evidence/p1/c1/generated/evidence.pdf?token=signed', token: 'signed' })
    }
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.prepareAccreditationEvidenceUpload({
    practiceId: 'p1', cycleId: 'c1', userId: 'u1',
    originalFilename: '../../Evidence final.pdf', mimeType: 'application/pdf', sizeBytes: 2048, category: 'POLICY_PROCEDURE',
  })

  const insert = calls.find((call) => call.url.includes('/rest/v1/accreditation_evidence'))
  assert.equal(insert.body[0].practice_id, 'p1')
  assert.equal(insert.body[0].cycle_id, 'c1')
  assert.equal(insert.body[0].original_filename, '../../Evidence final.pdf')
  assert.match(insert.body[0].storage_path, /^p1\/c1\/[0-9a-f-]+\/evidence\.pdf$/i)
  assert.doesNotMatch(insert.body[0].storage_path, /\.\.|Evidence final/)
  assert.equal(insert.body[0].processing_status, 'NOT_REVIEWED')
  assert.equal(result.upload.bucket, 'accreditation-evidence')
  assert.equal(result.upload.token, 'signed')
})

test('evidence listing includes active mappings and review state without losing tenant filters', async () => {
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    if (url.includes('accreditation_evidence?')) return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', title: 'Policy', status: 'ACTIVE', processing_status: 'NOT_REVIEWED' }])
    if (url.includes('accreditation_evidence_requirement_links?')) return json([{ evidence_id: 'e1', requirement_id: 'R1', is_active: true }])
    if (url.includes('accreditation_evidence_assessments?')) return json([])
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const rows = await server.listAccreditationEvidence({ practiceId: 'p1', cycleId: 'c1' })
  assert.equal(rows[0].mappings[0].requirementId, 'R1')
  assert.equal(rows[0].processingStatus, 'NOT_REVIEWED')
  for (const url of urls) {
    assert.match(url, /practice_id=eq\.p1/)
    assert.match(url, /cycle_id=eq\.c1/)
  }
})

test('link evidence validates evidence and requirement before mapping inside the same tenant cycle', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null })
    if (url.includes('accreditation_evidence?')) return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', status: 'ACTIVE' }])
    if (url.includes('accreditation_requirements?')) return json([{ id: 'R1', is_active: true }])
    if (url.includes('accreditation_evidence_requirement_links?on_conflict=')) return json([{ id: 'l1', evidence_id: 'e1', requirement_id: 'R1' }])
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const row = await server.linkAccreditationEvidence({ practiceId: 'p1', cycleId: 'c1', evidenceId: 'e1', requirementId: 'R1' })
  assert.equal(row.id, 'l1')
  const evidenceLookup = calls.find((call) => call.url.includes('accreditation_evidence?'))
  assert.match(evidenceLookup.url, /practice_id=eq\.p1/)
  assert.match(evidenceLookup.url, /cycle_id=eq\.c1/)
})

test('superseding evidence disables its active mappings and assessments and preserves an audit record', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null })
    if ((options.method || 'GET') === 'GET' && url.includes('accreditation_evidence?')) return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', status: 'ACTIVE' }])
    if ((options.method || 'GET') === 'GET' && url.includes('accreditation_evidence_requirement_links?')) return json([{ evidence_id: 'e1', requirement_id: 'R1', is_active: true }])
    if ((options.method || 'GET') === 'PATCH' && url.includes('accreditation_evidence?')) return json([{ id: 'e1', status: 'SUPERSEDED' }])
    if ((options.method || 'GET') === 'PATCH' && url.includes('accreditation_evidence_requirement_links?')) return json([])
    if ((options.method || 'GET') === 'PATCH' && url.includes('accreditation_evidence_assessments?')) return json([])
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.supersedeAccreditationEvidence({ practiceId: 'p1', cycleId: 'c1', evidenceId: 'e1' })
  assert.deepEqual(result.affectedRequirementIds, ['R1'])
  assert.equal(result.evidence.status, 'SUPERSEDED')
})

test('download signing only occurs after tenant-scoped evidence lookup', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })
    if (url.includes('/rest/v1/accreditation_evidence?')) return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', storage_path: 'p1/c1/x/evidence.pdf', storage_bucket: 'accreditation-evidence', status: 'ACTIVE' }])
    if (url.includes('/storage/v1/object/sign/accreditation-evidence/')) return json({ signedURL: 'https://project.supabase.co/storage/v1/object/sign/accreditation-evidence/p1/c1/x/evidence.pdf?token=download' })
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.createAccreditationEvidenceDownload({ practiceId: 'p1', cycleId: 'c1', evidenceId: 'e1' })
  assert.match(calls[0].url, /practice_id=eq\.p1/)
  assert.match(calls[0].url, /cycle_id=eq\.c1/)
  assert.match(result.signedUrl, /token=download/)
})


test('human evidence review requires an active mapping and replaces the prior active assessment for that requirement', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET'
    const body = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : options.body
    calls.push({ url, method, body })
    if (method === 'GET' && url.includes('accreditation_evidence?')) {
      return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', status: 'ACTIVE' }])
    }
    if (method === 'GET' && url.includes('accreditation_evidence_requirement_links?')) {
      return json([{ id: 'l1', evidence_id: 'e1', requirement_id: 'R1', is_active: true }])
    }
    if (method === 'PATCH' && url.includes('accreditation_evidence_assessments?')) return json([])
    if (method === 'POST' && url.includes('/rest/v1/accreditation_evidence_assessments')) {
      return json([{ id: 'a2', ...body[0] }])
    }
    throw new Error(`unexpected ${method} ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.reviewAccreditationEvidence({
    practiceId: 'p1',
    cycleId: 'c1',
    evidenceId: 'e1',
    requirementId: 'R1',
    userId: 'u1',
    reviewStatus: 'INCOMPLETE',
    reason: 'Two required entries are missing.',
    recommendedAction: 'Complete the register.',
  })
  assert.equal(result.reviewStatus, 'INCOMPLETE')
  const deactivation = calls.find((call) => call.method === 'PATCH' && call.url.includes('accreditation_evidence_assessments?'))
  assert.match(deactivation.url, /evidence_id=eq.e1/)
  assert.match(deactivation.url, /requirement_id=eq.R1/)
  assert.equal(deactivation.body.is_active, false)
  const inserted = calls.find((call) => call.method === 'POST' && call.url.includes('/rest/v1/accreditation_evidence_assessments'))
  assert.equal(inserted.body[0].practice_id, 'p1')
  assert.equal(inserted.body[0].cycle_id, 'c1')
  assert.equal(inserted.body[0].evidence_id, 'e1')
  assert.equal(inserted.body[0].requirement_id, 'R1')
  assert.equal(inserted.body[0].review_status, 'INCOMPLETE')
  assert.equal(inserted.body[0].human_review_required, false)
  assert.equal(inserted.body[0].model, null)
  assert.equal(inserted.body[0].openai_response_id, null)
})

test('human evidence review refuses a requirement that is not actively mapped to the evidence', async () => {
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET'
    if (method === 'GET' && url.includes('accreditation_evidence?')) {
      return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', status: 'ACTIVE' }])
    }
    if (method === 'GET' && url.includes('accreditation_evidence_requirement_links?')) return json([])
    throw new Error(`unexpected ${method} ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  await assert.rejects(
    () => server.reviewAccreditationEvidence({
      practiceId: 'p1',
      cycleId: 'c1',
      evidenceId: 'e1',
      requirementId: 'R1',
      userId: 'u1',
      reviewStatus: 'OUTDATED',
      reason: 'Review date has passed.',
      recommendedAction: 'Upload the current version.',
    }),
    /not mapped/i,
  )
})
