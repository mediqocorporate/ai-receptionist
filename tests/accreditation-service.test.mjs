import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const serviceUrl = new URL('../src/services/accreditation-service.js', import.meta.url)

async function loadService() {
  if (!fs.existsSync(serviceUrl)) return null
  return import(serviceUrl.href)
}

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

test('accreditation browser service exists', () => {
  assert.equal(fs.existsSync(serviceUrl), true)
})

test('overview sends authenticated bearer token to configured endpoint', async () => {
  const mod = await loadService()
  assert.ok(mod)
  let request
  const service = mod.createAccreditationService({
    config: { accreditationApiUrl: '/api/accreditation' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (url, init) => {
      request = { url, init }
      return response(200, { overview: { cycle: { id: 'c1' } } })
    },
  })
  const result = await service.overview()
  assert.equal(request.url, '/api/accreditation')
  assert.equal(request.init.headers.Authorization, 'Bearer jwt')
  assert.deepEqual(JSON.parse(request.init.body), { action: 'overview' })
  assert.equal(result.cycle.id, 'c1')
})

test('answer and requirement actions preserve server-owned cycle identity', async () => {
  const mod = await loadService()
  assert.ok(mod)
  const payloads = []
  const service = mod.createAccreditationService({
    config: { accreditationApiUrl: '/api/accreditation' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      payloads.push(body)
      if (body.action === 'answer') return response(200, { overview: { cycle: { id: 'c1' } }, assessment: { readinessStatus: 'NOT_CHECKED' } })
      return response(200, { requirement: { id: 'R1' }, cycleId: 'c1' })
    },
  })
  await service.answer({ cycleId: 'c1', questionId: 'Q1', answerLabel: "I'm not sure" })
  await service.requirement({ cycleId: 'c1', requirementId: 'R1' })
  assert.deepEqual(payloads[0], { action: 'answer', cycleId: 'c1', questionId: 'Q1', answerLabel: "I'm not sure", answerDetail: {} })
  assert.deepEqual(payloads[1], { action: 'requirement', cycleId: 'c1', requirementId: 'R1' })
})

test('service rejects missing session and maps safe API errors', async () => {
  const mod = await loadService()
  assert.ok(mod)
  const noSession = mod.createAccreditationService({
    config: { accreditationApiUrl: '/api/accreditation' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
    fetchImpl: async () => { throw new Error('should not fetch') },
  })
  await assert.rejects(() => noSession.overview(), /sign in/i)

  const failing = mod.createAccreditationService({
    config: { accreditationApiUrl: '/api/accreditation' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async () => response(500, { message: 'MediQo could not load accreditation readiness. Please try again.' }),
  })
  await assert.rejects(() => failing.overview(), /could not load accreditation readiness/i)
})


test('accreditation service falls back to the local API route when runtime config is stale or missing the route', async () => {
  let request
  const mod = await loadService()
  const service = mod.createAccreditationService({
    config: {},
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (url, init) => {
      request = { url, init }
      return response(200, { overview: { cycle: { id: 'c1' } } })
    },
  })

  const result = await service.overview()

  assert.equal(request.url, '/api/accreditation')
  assert.equal(request.init.headers.Authorization, 'Bearer jwt')
  assert.equal(result.cycle.id, 'c1')
})
