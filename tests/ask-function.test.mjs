import test from 'node:test'
import assert from 'node:assert/strict'
import { createAskHandler } from '../netlify/functions/ask.mjs'

function event({ body = {}, authorization = '', cookie = '', proto = 'https' } = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(cookie ? { cookie } : {}),
      'x-forwarded-proto': proto,
      host: 'pm.mediqo.health',
    },
    body: JSON.stringify(body),
  }
}

test('invalid bearer authentication returns 401 and is never downgraded to anonymous', async () => {
  let serverCreated = false
  const handler = createAskHandler({
    authenticate: async () => null,
    createServer: () => { serverCreated = true; return {} },
    generateAnswer: async () => { throw new Error('should not call') },
    processAskFn: async () => { throw new Error('should not call') },
  })
  const response = await handler(event({ authorization: 'Bearer invalid', body: { question: 'Hello' } }))
  assert.equal(response.statusCode, 401)
  assert.equal(JSON.parse(response.body).code, 'invalid_session')
  assert.equal(serverCreated, false)
})

test('anonymous request stores only a hash of a newly issued opaque cookie token', async () => {
  let receivedHash = ''
  const handler = createAskHandler({
    authenticate: async () => null,
    createServer: () => ({ marker: 'server' }),
    randomTokenFn: () => 'raw-secret-token',
    hashFn: async (value) => `hash:${value}`,
    generateAnswer: async () => ({ answer: {} }),
    processAskFn: async (input) => {
      receivedHash = input.anonymousTokenHash
      return { statusCode: 200, body: { ok: true } }
    },
    env: { OPENAI_API_KEY: 'server-secret' },
  })
  const response = await handler(event({ body: { question: 'Hello' } }))
  assert.equal(response.statusCode, 200)
  assert.equal(receivedHash, 'hash:raw-secret-token')
  assert.match(response.headers['Set-Cookie'], /^mediqo_anon=raw-secret-token;/)
  assert.match(response.headers['Set-Cookie'], /HttpOnly/)
  assert.doesNotMatch(receivedHash, /^raw-secret-token$/)
})

test('authenticated request claims prior anonymous history before asking', async () => {
  const order = []
  const server = {
    claimAnonymous: async (hash, userId, practiceId) => { order.push(['claim', hash, userId, practiceId]) },
  }
  const actor = { userId: 'u1', practiceId: 'p1', email: 'a@example.com' }
  const handler = createAskHandler({
    authenticate: async () => actor,
    createServer: () => server,
    hashFn: async (value) => `hash:${value}`,
    processAskFn: async (input) => { order.push(['ask', input.actor.userId]); return { statusCode: 200, body: { ok: true } } },
    env: { OPENAI_API_KEY: 'server-secret' },
  })
  const response = await handler(event({ authorization: 'Bearer good', cookie: 'mediqo_anon=old-token', body: { question: 'Hello' } }))
  assert.equal(response.statusCode, 200)
  assert.deepEqual(order, [
    ['claim', 'hash:old-token', 'u1', 'p1'],
    ['ask', 'u1'],
  ])
  assert.match(response.headers?.['Set-Cookie'] || '', /^mediqo_anon=;/)
  assert.match(response.headers['Set-Cookie'], /Max-Age=0/)
})

test('a stale anonymous cookie claimed by another account does not block an authenticated user', async () => {
  let asked = false
  const handler = createAskHandler({
    authenticate: async () => ({ userId: 'u2', practiceId: 'p2', email: 'b@example.com' }),
    createServer: () => ({ claimAnonymous: async () => { throw new Error('anonymous_session_already_claimed') } }),
    hashFn: async (value) => `hash:${value}`,
    processAskFn: async () => { asked = true; return { statusCode: 200, body: { ok: true } } },
  })
  const response = await handler(event({ authorization: 'Bearer good', cookie: 'mediqo_anon=old-owner', body: { question: 'Hello' } }))
  assert.equal(response.statusCode, 200)
  assert.equal(asked, true)
  assert.match(response.headers['Set-Cookie'], /Max-Age=0/)
})
