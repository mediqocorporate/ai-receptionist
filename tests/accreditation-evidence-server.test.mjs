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

test('prepare evidence upload inserts tenant metadata and requests signed upload for a generated path', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const body = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : null
    calls.push({ url, method: options.method || 'GET', body })
    if (url.includes('/rest/v1/accreditation_evidence')) {
      return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', storage_path: body?.[0]?.storage_path, status: 'ACTIVE', processing_status: 'PENDING' }])
    }
    if (url.includes('/storage/v1/object/upload/sign/accreditation-evidence/')) {
      return json({ url: '/object/upload/sign/accreditation-evidence/p1/c1/generated/evidence.pdf?token=signed', token: 'signed' })
    }
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.prepareAccreditationEvidenceUpload({
    practiceId: 'p1',
    cycleId: 'c1',
    userId: 'u1',
    originalFilename: '../../Evidence final.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    category: 'POLICY_PROCEDURE',
  })

  const insert = calls.find((call) => call.url.includes('/rest/v1/accreditation_evidence'))
  assert.equal(insert.body[0].practice_id, 'p1')
  assert.equal(insert.body[0].cycle_id, 'c1')
  assert.equal(insert.body[0].original_filename, '../../Evidence final.pdf')
  assert.match(insert.body[0].storage_path, /^p1\/c1\/[0-9a-f-]+\/evidence\.pdf$/i)
  assert.doesNotMatch(insert.body[0].storage_path, /\.\.|Evidence final/)
  assert.equal(result.upload.bucket, 'accreditation-evidence')
  assert.equal(result.upload.token, 'signed')
})

test('evidence listing includes active mappings and never drops practice/cycle filters', async () => {
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    if (url.includes('accreditation_evidence?')) return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', title: 'Policy', status: 'ACTIVE' }])
    if (url.includes('accreditation_evidence_requirement_links?')) return json([{ evidence_id: 'e1', requirement_id: 'R1', is_active: true }])
    if (url.includes('accreditation_evidence_assessments?')) return json([{ evidence_id: 'e1', requirement_id: 'R1', review_status: 'NOT_REVIEWED', is_active: true }])
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const rows = await server.listAccreditationEvidence({ practiceId: 'p1', cycleId: 'c1' })
  assert.equal(rows[0].mappings[0].requirementId, 'R1')
  assert.equal(rows[0].assessments[0].reviewStatus, 'NOT_REVIEWED')
  for (const url of urls) {
    assert.match(url, /practice_id=eq\.p1/)
    assert.match(url, /cycle_id=eq\.c1/)
  }
})

test('link evidence validates evidence and requirement in the same tenant cycle before insert', async () => {
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

test('superseding evidence disables links and assessments and returns affected requirement ids', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null })
    if ((options.method || 'GET') === 'GET' && url.includes('accreditation_evidence?')) return json([{ id: 'e1', practice_id: 'p1', cycle_id: 'c1', status: 'ACTIVE' }])
    if ((options.method || 'GET') === 'GET' && url.includes('accreditation_evidence_requirement_links?')) return json([{ evidence_id: 'e1', requirement_id: 'R1', is_active: true }, { evidence_id: 'e1', requirement_id: 'R2', is_active: true }])
    if ((options.method || 'GET') === 'PATCH' && url.includes('accreditation_evidence?')) return json([{ id: 'e1', status: 'SUPERSEDED' }])
    if ((options.method || 'GET') === 'PATCH' && url.includes('accreditation_evidence_requirement_links?')) return json([])
    if ((options.method || 'GET') === 'PATCH' && url.includes('accreditation_evidence_assessments?')) return json([])
    throw new Error(`unexpected ${url}`)
  }
  const server = createSupabaseServer({ env, fetchImpl })
  const result = await server.supersedeAccreditationEvidence({ practiceId: 'p1', cycleId: 'c1', evidenceId: 'e1' })
  assert.deepEqual(result.affectedRequirementIds.sort(), ['R1','R2'])
  assert.equal(result.evidence.status, 'SUPERSEDED')
  assert.equal(calls.filter((call) => call.method === 'PATCH').length, 3)
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
