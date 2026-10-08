import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationEvidenceService } from '../src/services/accreditation-evidence-service.js'

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

test('browser evidence service lists and mutates evidence using bearer-authenticated endpoint', async () => {
  const payloads = []
  const service = createAccreditationEvidenceService({
    clientProvider: async () => ({
      auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) },
      storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) },
    }),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      payloads.push({ body, auth: init.headers.Authorization })
      if (body.action === 'list') return response(200, { evidence: [{ id: 'e1' }] })
      if (body.action === 'link') return response(200, { link: { id: 'l1' } })
      if (body.action === 'supersede') return response(200, { evidence: { id: 'e1', status: 'SUPERSEDED' }, affectedRequirementIds: ['R1'] })
      return response(200, { download: { signedUrl: 'https://signed.example/e1' } })
    },
  })
  assert.equal((await service.list({ cycleId: 'c1' }))[0].id, 'e1')
  await service.link({ cycleId: 'c1', evidenceId: 'e1', requirementId: 'R1' })
  await service.supersede({ cycleId: 'c1', evidenceId: 'e1' })
  assert.equal((await service.download({ cycleId: 'c1', evidenceId: 'e1' })).signedUrl, 'https://signed.example/e1')
  assert.equal(payloads.every((entry) => entry.auth === 'Bearer jwt'), true)
})

test('upload uses server preparation, Supabase signed upload, then server finalization', async () => {
  const payloads = []
  let uploadCall
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'accreditation-evidence')
        return {
          async uploadToSignedUrl(path, token, file) {
            uploadCall = { path, token, file }
            return { data: { path }, error: null }
          },
        }
      },
    },
  }
  const service = createAccreditationEvidenceService({
    clientProvider: async () => client,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      payloads.push(body)
      if (body.action === 'prepareUpload') return response(200, {
        evidence: { id: 'e1' },
        upload: { bucket: 'accreditation-evidence', path: 'p1/c1/x/evidence.pdf', token: 'signed-token' },
      })
      if (body.action === 'finalizeUpload') return response(200, { evidence: { id: 'e1', title: 'Evidence', processing_status: 'PENDING' }, job: { id: 'j1' } })
      throw new Error('unexpected action')
    },
  })
  const file = { name: 'Evidence.pdf', type: 'application/pdf', size: 1000 }
  const result = await service.upload({
    cycleId: 'c1',
    file,
    category: 'POLICY_PROCEDURE',
    title: 'Evidence',
  })
  assert.equal(payloads[0].action, 'prepareUpload')
  assert.equal(payloads[1].action, 'finalizeUpload')
  assert.equal(payloads[1].evidenceId, 'e1')
  assert.equal(uploadCall.path, 'p1/c1/x/evidence.pdf')
  assert.equal(uploadCall.token, 'signed-token')
  assert.equal(uploadCall.file, file)
  assert.equal(result.evidence.processing_status, 'PENDING')
})
