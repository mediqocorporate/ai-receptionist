import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationEvidenceHandler } from '../netlify/functions/accreditation-evidence.mjs'

function event(body, authorization = 'Bearer jwt') {
  return { httpMethod: 'POST', headers: { authorization }, body: JSON.stringify(body) }
}

test('evidence API requires authentication', async () => {
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => null,
    createServer: () => ({}),
  })
  const response = await handler(event({ action: 'list', cycleId: 'c1' }, ''))
  assert.equal(response.statusCode, 401)
})

test('prepareUpload rejects unsupported or oversized evidence before creating a signed upload', async () => {
  let prepareCalls = 0
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async () => ({ id: 'c1' }),
      prepareAccreditationEvidenceUpload: async () => { prepareCalls += 1; return {} },
    }),
  })

  const unsupported = await handler(event({
    action: 'prepareUpload',
    cycleId: 'c1',
    filename: 'evidence.exe',
    mimeType: 'application/x-msdownload',
    sizeBytes: 100,
    category: 'OTHER',
  }))
  assert.equal(unsupported.statusCode, 400)

  const oversized = await handler(event({
    action: 'prepareUpload',
    cycleId: 'c1',
    filename: 'evidence.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 10485761,
    category: 'OTHER',
  }))
  assert.equal(oversized.statusCode, 400)
  assert.equal(prepareCalls, 0)
})

test('prepareUpload uses authenticated practice identity and server-generated storage path', async () => {
  let payload
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async (practiceId, cycleId) => {
        assert.equal(practiceId, 'p1')
        assert.equal(cycleId, 'c1')
        return { id: 'c1' }
      },
      prepareAccreditationEvidenceUpload: async (value) => {
        payload = value
        return {
          evidence: { id: 'e1', storage_path: 'p1/c1/uuid/evidence.pdf' },
          upload: { bucket: 'accreditation-evidence', path: 'p1/c1/uuid/evidence.pdf', token: 'signed-token' },
        }
      },
    }),
  })

  const response = await handler(event({
    action: 'prepareUpload',
    practiceId: 'evil',
    cycleId: 'c1',
    filename: '../../Evidence final.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    category: 'POLICY_PROCEDURE',
  }))
  assert.equal(response.statusCode, 200)
  assert.equal(payload.practiceId, 'p1')
  assert.equal(payload.userId, 'u1')
  assert.equal(payload.cycleId, 'c1')
  assert.equal(payload.originalFilename, '../../Evidence final.pdf')
  assert.equal(payload.category, 'POLICY_PROCEDURE')
})

test('list, link, supersede and download remain scoped to authenticated practice', async () => {
  const seen = []
  const server = {
    getOrCreateAccreditationCycle: async () => ({ id: 'c1' }),
    listAccreditationEvidence: async (value) => { seen.push(['list', value]); return [] },
    linkAccreditationEvidence: async (value) => { seen.push(['link', value]); return { id: 'l1' } },
    supersedeAccreditationEvidence: async (value) => { seen.push(['supersede', value]); return { evidence: { id: 'e1', status: 'SUPERSEDED' }, affectedRequirementIds: ['R1'] } },
    createAccreditationEvidenceDownload: async (value) => { seen.push(['download', value]); return { signedUrl: 'https://signed.example/file' } },
  }
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => server,
  })

  assert.equal((await handler(event({ action: 'list', cycleId: 'c1', practiceId: 'evil' }))).statusCode, 200)
  assert.equal((await handler(event({ action: 'link', cycleId: 'c1', evidenceId: 'e1', requirementId: 'R1', practiceId: 'evil' }))).statusCode, 200)
  assert.equal((await handler(event({ action: 'supersede', cycleId: 'c1', evidenceId: 'e1', practiceId: 'evil' }))).statusCode, 200)
  assert.equal((await handler(event({ action: 'download', cycleId: 'c1', evidenceId: 'e1', practiceId: 'evil' }))).statusCode, 200)

  for (const [, value] of seen) assert.equal(value.practiceId, 'p1')
})

test('finalizeUpload creates the processing job only for authenticated practice evidence', async () => {
  let payload
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async () => ({ id: 'c1' }),
      finalizeAccreditationEvidenceUpload: async (value) => {
        payload = value
        return { evidence: { id: 'e1', title: value.title, processing_status: 'PENDING' }, job: { id: 'j1', status: 'PENDING' } }
      },
    }),
  })
  const response = await handler(event({
    action: 'finalizeUpload',
    cycleId: 'c1',
    evidenceId: 'e1',
    title: 'Privacy procedure',
    description: 'Current practice procedure',
    documentDate: '2026-09-01',
    reviewDate: '2027-09-01',
  }))
  assert.equal(response.statusCode, 200)
  assert.equal(payload.practiceId, 'p1')
  assert.equal(payload.evidenceId, 'e1')
  assert.equal(payload.title, 'Privacy procedure')
  assert.match(response.body, /PENDING/)
})
