import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccreditationEvidenceHandler, MAX_EVIDENCE_FILE_BYTES } from '../netlify/functions/accreditation-evidence.mjs'

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

test('prepareUpload enforces the 25 MB limit and approved file types before creating a signed upload', async () => {
  assert.equal(MAX_EVIDENCE_FILE_BYTES, 25 * 1024 * 1024)
  let prepareCalls = 0
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async () => ({ id: 'c1' }),
      prepareAccreditationEvidenceUpload: async () => { prepareCalls += 1; return { evidence: { id: 'e1' }, upload: { token: 't' } } },
    }),
  })

  const allowed = [
    ['evidence.pdf', 'application/pdf'],
    ['policy.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['register.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['register.csv', 'text/csv'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['photo.png', 'image/png'],
  ]
  for (const [filename, mimeType] of allowed) {
    const response = await handler(event({ action: 'prepareUpload', cycleId: 'c1', filename, mimeType, sizeBytes: 1024, category: 'OTHER' }))
    assert.equal(response.statusCode, 200, filename)
  }

  const unsupported = await handler(event({ action: 'prepareUpload', cycleId: 'c1', filename: 'notes.txt', mimeType: 'text/plain', sizeBytes: 100, category: 'OTHER' }))
  assert.equal(unsupported.statusCode, 400)

  const oversized = await handler(event({ action: 'prepareUpload', cycleId: 'c1', filename: 'evidence.pdf', mimeType: 'application/pdf', sizeBytes: MAX_EVIDENCE_FILE_BYTES + 1, category: 'OTHER' }))
  assert.equal(oversized.statusCode, 400)
  assert.equal(prepareCalls, allowed.length)
})

test('evidence API ignores caller practice ids and scopes list/link/supersede/download to authenticated practice', async () => {
  const seen = []
  const server = {
    getOrCreateAccreditationCycle: async (practiceId, cycleId) => {
      assert.equal(practiceId, 'p1')
      return { id: cycleId || 'c1' }
    },
    listAccreditationEvidence: async (value) => { seen.push(['list', value]); return [] },
    linkAccreditationEvidence: async (value) => { seen.push(['link', value]); return { id: 'l1' } },
    supersedeAccreditationEvidence: async (value) => { seen.push(['supersede', value]); return { evidence: { id: 'e1', status: 'SUPERSEDED' }, affectedRequirementIds: ['R1'] } },
    createAccreditationEvidenceDownload: async (value) => { seen.push(['download', value]); return { signedUrl: 'https://signed.example/file' } },
  }
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => server,
  })

  for (const payload of [
    { action: 'list', cycleId: 'c1', practiceId: 'evil' },
    { action: 'link', cycleId: 'c1', evidenceId: 'e1', requirementId: 'R1', practiceId: 'evil' },
    { action: 'supersede', cycleId: 'c1', evidenceId: 'e1', practiceId: 'evil' },
    { action: 'download', cycleId: 'c1', evidenceId: 'e1', practiceId: 'evil' },
  ]) assert.equal((await handler(event(payload))).statusCode, 200)

  for (const [, value] of seen) assert.equal(value.practiceId, 'p1')
})

test('finalizeUpload keeps new evidence honestly Not Reviewed until evidence intelligence is implemented', async () => {
  let payload
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async () => ({ id: 'c1' }),
      finalizeAccreditationEvidenceUpload: async (value) => {
        payload = value
        return { id: 'e1', title: value.title, processing_status: 'NOT_REVIEWED' }
      },
    }),
  })
  const response = await handler(event({ action: 'finalizeUpload', cycleId: 'c1', evidenceId: 'e1', title: 'Privacy procedure' }))
  assert.equal(response.statusCode, 200)
  assert.equal(payload.practiceId, 'p1')
  assert.match(response.body, /NOT_REVIEWED/)
})


test('evidence review API records an explicit human review without trusting caller practice ids', async () => {
  let reviewed
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async () => ({ id: 'c1' }),
      reviewAccreditationEvidence: async (value) => {
        reviewed = value
        return { id: 'a1', reviewStatus: value.reviewStatus }
      },
    }),
  })

  const response = await handler(event({
    action: 'review',
    cycleId: 'c1',
    evidenceId: 'e1',
    requirementId: 'R1',
    reviewStatus: 'INCOMPLETE',
    reason: 'The register is missing two staff records.',
    recommendedAction: 'Add the missing records and review again.',
    practiceId: 'evil',
  }))
  assert.equal(response.statusCode, 200)
  assert.equal(reviewed.practiceId, 'p1')
  assert.equal(reviewed.userId, 'u1')
  assert.equal(reviewed.reviewStatus, 'INCOMPLETE')
  assert.match(response.body, /INCOMPLETE/)
})

test('evidence review API rejects invalid review states and empty reasons', async () => {
  let calls = 0
  const handler = createAccreditationEvidenceHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async () => ({ id: 'c1' }),
      reviewAccreditationEvidence: async () => { calls += 1; return {} },
    }),
  })
  const invalid = await handler(event({ action: 'review', cycleId: 'c1', evidenceId: 'e1', requirementId: 'R1', reviewStatus: 'READY', reason: 'No.' }))
  const emptyReason = await handler(event({ action: 'review', cycleId: 'c1', evidenceId: 'e1', requirementId: 'R1', reviewStatus: 'OUTDATED', reason: '' }))
  assert.equal(invalid.statusCode, 400)
  assert.equal(emptyReason.statusCode, 400)
  assert.equal(calls, 0)
})
