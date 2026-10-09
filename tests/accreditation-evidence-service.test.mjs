import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationEvidenceService, MAX_EVIDENCE_BATCH_FILES, MAX_EVIDENCE_FILE_BYTES } from '../src/services/accreditation-evidence-service.js'

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

function client() {
  return {
    auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) },
    storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) },
  }
}

test('browser evidence service exposes the client-approved batch and file limits', () => {
  assert.equal(MAX_EVIDENCE_BATCH_FILES, 50)
  assert.equal(MAX_EVIDENCE_FILE_BYTES, 25 * 1024 * 1024)
})

test('uploadBatch rejects more than 50 files before any network call', async () => {
  let calls = 0
  const service = createAccreditationEvidenceService({
    clientProvider: async () => client(),
    fetchImpl: async () => { calls += 1; return response(200, {}) },
  })
  const files = Array.from({ length: 51 }, (_, i) => ({ name: `evidence-${i}.pdf`, type: 'application/pdf', size: 10 }))
  await assert.rejects(() => service.uploadBatch({ cycleId: 'c1', files }), /50 files/i)
  assert.equal(calls, 0)
})

test('uploadBatch performs signed uploads and can map every uploaded file to the source requirement', async () => {
  const payloads = []
  const uploaded = []
  const fakeClient = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'accreditation-evidence')
        return {
          async uploadToSignedUrl(path, token, file) {
            uploaded.push({ path, token, file })
            return { data: { path }, error: null }
          },
        }
      },
    },
  }
  let next = 0
  const service = createAccreditationEvidenceService({
    clientProvider: async () => fakeClient,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      payloads.push(body)
      if (body.action === 'prepareUpload') {
        next += 1
        return response(200, { evidence: { id: `e${next}` }, upload: { bucket: 'accreditation-evidence', path: `p1/c1/x${next}/evidence.pdf`, token: `t${next}` } })
      }
      if (body.action === 'finalizeUpload') return response(200, { evidence: { id: body.evidenceId, processing_status: 'NOT_REVIEWED' } })
      if (body.action === 'link') return response(200, { link: { id: `l-${body.evidenceId}` } })
      throw new Error('unexpected action')
    },
  })

  const files = [
    { name: 'one.pdf', type: 'application/pdf', size: 1000 },
    { name: 'two.pdf', type: 'application/pdf', size: 1000 },
  ]
  const result = await service.uploadBatch({ cycleId: 'c1', files, category: 'AUDIT_REPORT', requirementId: 'R1' })
  assert.equal(result.length, 2)
  assert.equal(uploaded.length, 2)
  assert.equal(payloads.filter((item) => item.action === 'link').length, 2)
  assert.equal(payloads.filter((item) => item.action === 'link').every((item) => item.requirementId === 'R1'), true)
})

test('list, link, download and supersede use bearer-authenticated evidence endpoint', async () => {
  const payloads = []
  const service = createAccreditationEvidenceService({
    clientProvider: async () => client(),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      payloads.push({ body, auth: init.headers.Authorization })
      if (body.action === 'list') return response(200, { evidence: [{ id: 'e1' }] })
      if (body.action === 'link') return response(200, { link: { id: 'l1' } })
      if (body.action === 'download') return response(200, { download: { signedUrl: 'https://signed.example/e1' } })
      return response(200, { evidence: { id: 'e1', status: 'SUPERSEDED' }, affectedRequirementIds: ['R1'] })
    },
  })
  assert.equal((await service.list({ cycleId: 'c1' }))[0].id, 'e1')
  await service.link({ cycleId: 'c1', evidenceId: 'e1', requirementId: 'R1' })
  assert.equal((await service.download({ cycleId: 'c1', evidenceId: 'e1' })).signedUrl, 'https://signed.example/e1')
  await service.supersede({ cycleId: 'c1', evidenceId: 'e1' })
  assert.equal(payloads.every((entry) => entry.auth === 'Bearer jwt'), true)
})
