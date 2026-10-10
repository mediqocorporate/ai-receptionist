import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { ACCREDITATION_SUBROUTES } from '../src/data/routes.js'
import { renderAccreditationMissing } from '../src/components/accreditation/missing.js'
import { createSupabaseServer } from '../netlify/functions/_shared/supabase-server.mjs'

const actionsUiUrl = new URL('../src/components/accreditation/actions.js', import.meta.url)
const actionsServiceUrl = new URL('../src/services/accreditation-actions-service.js', import.meta.url)
const actionsFunctionUrl = new URL('../netlify/functions/accreditation-actions.mjs', import.meta.url)
const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')

function event(body = {}, authorization = 'Bearer jwt') {
  return { httpMethod: 'POST', headers: authorization ? { authorization } : {}, body: JSON.stringify(body) }
}

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

async function load(url) {
  if (!fs.existsSync(url)) return null
  return import(url.href)
}

test('Actions is activated as the next accreditation workflow section', () => {
  assert.equal(ACCREDITATION_SUBROUTES.find((item) => item.view === 'actions')?.available, true)
})

test('Actions workspace shows outstanding work, owners, due dates and safe completion language', async () => {
  const mod = await load(actionsUiUrl)
  assert.ok(mod)
  const html = mod.renderAccreditationActions({
    loaded: true,
    summary: { open: 1, inProgress: 1, blocked: 1, done: 1, overdue: 1 },
    owners: [{ id: 'u1', name: 'Practice Manager' }],
    items: [
      {
        id: 'a1',
        title: 'Update patient record process',
        description: 'Close the confirmed gap.',
        priority: 'HIGH',
        status: 'OPEN',
        ownerUserId: 'u1',
        ownerName: 'Practice Manager',
        dueDate: '2026-10-20',
        requirementId: 'R1',
        requirementIndicator: 'C7.1C',
        requirementTitle: 'Content of patient health records',
        sourceReason: 'Confirmed gap',
        completionNote: '',
      },
    ],
    filters: { status: 'ALL', priority: 'ALL', owner: 'ALL' },
    editor: null,
  })
  assert.match(html, /Actions/i)
  assert.match(html, /Open/i)
  assert.match(html, /In progress/i)
  assert.match(html, /Blocked/i)
  assert.match(html, /Overdue/i)
  assert.match(html, /Practice Manager/i)
  assert.match(html, /20 Oct 2026/i)
  assert.match(html, /C7\.1C/)
  assert.match(html, /Create action/i)
  assert.match(html, /Completing an action does not change readiness/i)
  assert.match(html, /data-accreditation-action-filter="status"/)
})

test("What's Missing offers a Create action path with requirement context", () => {
  const html = renderAccreditationMissing({
    summary: { totalItems: 1, confirmedGaps: 1, needsAttention: 0, evidenceIssues: 0, applicabilityToConfirm: 0, notChecked: 0 },
    items: [{
      requirementId: 'R1',
      indicator: 'C7.1C',
      title: 'Content of patient health records',
      priority: 'HIGH',
      issueCodes: ['CONFIRMED_GAP'],
      whyShown: 'The practice reported this is not in place.',
      nextAction: 'Address the gap.',
      expectedEvidence: [],
    }],
  })
  assert.match(html, /data-action="accreditation-create-action"/)
  assert.match(html, /data-requirement-id="R1"/)
  assert.match(html, /Create action/i)
})

test('Actions browser service lists, creates and updates through the dedicated endpoint', async () => {
  const mod = await load(actionsServiceUrl)
  assert.ok(mod)
  const payloads = []
  const service = mod.createAccreditationActionsService({
    config: { accreditationActionsApiUrl: '/api/accreditation-actions' },
    clientProvider: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } }),
    fetchImpl: async (_url, init) => {
      payloads.push(JSON.parse(init.body))
      return response(200, { actions: { items: [], owners: [], summary: {} }, action: { id: 'a1' } })
    },
  })
  await service.list({ cycleId: 'c1' })
  await service.create({ cycleId: 'c1', action: { title: 'Follow up', priority: 'HIGH' } })
  await service.update({ cycleId: 'c1', actionId: 'a1', patch: { status: 'DONE', completionNote: 'Rechecked separately.' } })
  assert.deepEqual(payloads, [
    { action: 'list', cycleId: 'c1' },
    { action: 'create', cycleId: 'c1', item: { title: 'Follow up', priority: 'HIGH' } },
    { action: 'update', cycleId: 'c1', actionId: 'a1', patch: { status: 'DONE', completionNote: 'Rechecked separately.' } },
  ])
})

test('Actions API requires authentication and scopes every operation to the authenticated practice', async () => {
  const mod = await load(actionsFunctionUrl)
  assert.ok(mod)
  const calls = []
  const server = {
    getOrCreateAccreditationCycle: async (practiceId, cycleId) => {
      assert.equal(practiceId, 'practice_1')
      return { id: cycleId || 'c1' }
    },
    listAccreditationActions: async (payload) => { calls.push(['list', payload]); return { items: [], owners: [], summary: {} } },
    createAccreditationAction: async (payload) => { calls.push(['create', payload]); return { id: 'a1' } },
    updateAccreditationAction: async (payload) => { calls.push(['update', payload]); return { id: 'a1', status: payload.patch.status || 'OPEN' } },
  }
  const handler = mod.createAccreditationActionsHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'practice_1' }),
    createServer: () => server,
  })

  const unauthenticated = mod.createAccreditationActionsHandler({
    authenticate: async () => null,
    createServer: () => server,
  })
  assert.equal((await unauthenticated(event({ action: 'list', cycleId: 'c1' }, ''))).statusCode, 401)

  assert.equal((await handler(event({ action: 'list', cycleId: 'c1', practiceId: 'evil' }))).statusCode, 200)
  assert.equal((await handler(event({ action: 'create', cycleId: 'c1', practiceId: 'evil', item: { title: 'Fix gap', priority: 'HIGH' } }))).statusCode, 200)
  assert.equal((await handler(event({ action: 'update', cycleId: 'c1', practiceId: 'evil', actionId: 'a1', patch: { status: 'DONE' } }))).statusCode, 200)

  for (const [, payload] of calls) {
    assert.equal(payload.practiceId, 'practice_1')
    assert.equal(payload.cycleId, 'c1')
  }
  assert.equal(calls[1][1].createdByUserId, 'u1')
  assert.equal(calls[2][1].updatedByUserId, 'u1')
})

test('marking an action done does not invoke or mutate accreditation readiness', async () => {
  const mod = await load(actionsFunctionUrl)
  assert.ok(mod)
  let updatePayload
  const handler = mod.createAccreditationActionsHandler({
    authenticate: async () => ({ userId: 'u1', practiceId: 'p1' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async () => ({ id: 'c1' }),
      updateAccreditationAction: async (payload) => { updatePayload = payload; return { id: 'a1', status: 'DONE' } },
    }),
  })
  const result = await handler(event({ action: 'update', cycleId: 'c1', actionId: 'a1', patch: { status: 'DONE', completionNote: 'Action finished.' } }))
  assert.equal(result.statusCode, 200)
  assert.equal(updatePayload.patch.status, 'DONE')
  assert.doesNotMatch(result.body, /readinessStatus|practiceRequirement|assessment/)
})

test('app integrates the Actions workspace and Create action path', () => {
  assert.match(appSource, /accreditationActionsService\.list\(/)
  assert.match(appSource, /accreditationActionsService\.create\(/)
  assert.match(appSource, /accreditationActionsService\.update\(/)
  assert.match(appSource, /accreditation-create-action/)
})


test('Supabase server lists practice-scoped actions with requirement, owner and overdue summary', async () => {
  const requests = []
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null })
    if (String(url).includes('/rest/v1/accreditation_actions?')) {
      return response(200, [
        {
          id: 'a1', practice_id: 'p1', cycle_id: 'c1', requirement_id: 'R1', title: 'Fix gap',
          description: 'Follow up', priority: 'HIGH', owner_user_id: 'u1', due_date: '2020-01-01',
          status: 'OPEN', source_reason: 'Confirmed gap', completion_note: '', created_at: '2026-10-10T00:00:00Z',
        },
      ])
    }
    if (String(url).includes('/rest/v1/practice_memberships?')) {
      return response(200, [{ user_id: 'u1', role: 'practice_manager' }])
    }
    if (String(url).includes('/rest/v1/profiles?')) {
      return response(200, [{ id: 'u1', first_name: 'Imran', last_name: 'Gul', job_title: 'Practice Manager' }])
    }
    if (String(url).includes('/rest/v1/accreditation_requirements?')) {
      return response(200, [{ id: 'R1', indicator: 'C7.1C', criterion_description: 'Content of patient health records' }])
    }
    return response(200, [])
  }
  const server = createSupabaseServer({
    env: { SUPABASE_URL: 'https://supabase.example', SUPABASE_PUBLISHABLE_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' },
    fetchImpl,
  })
  const result = await server.listAccreditationActions({ practiceId: 'p1', cycleId: 'c1' })
  assert.equal(result.items[0].ownerName, 'Imran Gul')
  assert.equal(result.items[0].requirementIndicator, 'C7.1C')
  assert.equal(result.summary.open, 1)
  assert.equal(result.summary.overdue, 1)
  assert.deepEqual(result.owners[0], { id: 'u1', name: 'Imran Gul', role: 'practice_manager', jobTitle: 'Practice Manager' })
  assert.ok(requests.find((request) => request.url.includes('practice_id=eq.p1') && request.url.includes('cycle_id=eq.c1')))
})

test('Supabase server creates and updates only cycle-scoped action rows and keeps DONE separate from readiness', async () => {
  const requests = []
  const fetchImpl = async (url, init = {}) => {
    const request = { url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null }
    requests.push(request)
    if (request.url.includes('/rest/v1/practice_memberships?')) {
      return response(200, [{ user_id: 'u1', role: 'practice_manager' }])
    }
    if (request.url.includes('/rest/v1/accreditation_requirements?')) {
      return response(200, [{ id: 'R1', indicator: 'C7.1C', criterion_description: 'Content of patient health records' }])
    }
    if (request.url.includes('/rest/v1/accreditation_actions?') && request.method === 'GET') {
      return response(200, [{ id: 'a1', practice_id: 'p1', cycle_id: 'c1', status: 'OPEN', title: 'Fix gap' }])
    }
    if (request.url.endsWith('/rest/v1/accreditation_actions') && request.method === 'POST') {
      return response(201, [{ id: 'a1', ...request.body[0] }])
    }
    if (request.url.includes('/rest/v1/accreditation_actions?') && request.method === 'PATCH') {
      return response(200, [{ id: 'a1', practice_id: 'p1', cycle_id: 'c1', title: 'Fix gap', ...request.body }])
    }
    return response(200, [])
  }
  const server = createSupabaseServer({
    env: { SUPABASE_URL: 'https://supabase.example', SUPABASE_PUBLISHABLE_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' },
    fetchImpl,
  })
  await server.createAccreditationAction({
    practiceId: 'p1', cycleId: 'c1', createdByUserId: 'u1',
    item: { title: 'Fix gap', description: 'Close it', priority: 'HIGH', ownerUserId: 'u1', dueDate: '2026-10-20', requirementId: 'R1', sourceReason: 'Confirmed gap' },
  })
  await server.updateAccreditationAction({
    practiceId: 'p1', cycleId: 'c1', actionId: 'a1', updatedByUserId: 'u1',
    patch: { status: 'DONE', completionNote: 'Task finished; requirement still needs re-check.' },
  })
  const insert = requests.find((request) => request.method === 'POST' && request.url.endsWith('/rest/v1/accreditation_actions'))
  assert.equal(insert.body[0].practice_id, 'p1')
  assert.equal(insert.body[0].cycle_id, 'c1')
  assert.equal(insert.body[0].owner_user_id, 'u1')
  const patch = requests.find((request) => request.method === 'PATCH' && request.url.includes('/rest/v1/accreditation_actions?'))
  assert.match(patch.url, /practice_id=eq\.p1/)
  assert.match(patch.url, /cycle_id=eq\.c1/)
  assert.equal(patch.body.status, 'DONE')
  assert.ok(patch.body.completed_at)
  assert.equal(requests.some((request) => /practice_requirements/.test(request.url) && request.method === 'PATCH'), false)
})
