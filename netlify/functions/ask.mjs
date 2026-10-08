import { processAsk } from './_shared/ask-core.mjs'
import { createMediQoAnswer } from './_shared/openai.mjs'
import { authenticateUser, createSupabaseServer } from './_shared/supabase-server.mjs'
import {
  ANONYMOUS_COOKIE_NAME,
  buildCookie,
  isSecureRequest,
  jsonResponse,
  parseCookies,
  parseJsonBody,
  randomToken,
  sha256Hex,
} from './_shared/http.mjs'

function header(event, name) {
  const headers = event?.headers || {}
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || ''
}

export function createAskHandler({
  env = process.env,
  authenticate = ({ authorization }) => authenticateUser({ authorization, env }),
  createServer = () => createSupabaseServer({ env }),
  generateAnswer = ({ question, safetyIdentifier }) => createMediQoAnswer({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || 'gpt-5.6',
    question,
    safetyIdentifier,
  }),
  processAskFn = processAsk,
  randomTokenFn = randomToken,
  hashFn = sha256Hex,
} = {}) {
  return async function handler(event = {}) {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'POST') {
      return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' }, { Allow: 'POST' })
    }

    let body
    try {
      body = parseJsonBody(event)
    } catch {
      return jsonResponse(400, { code: 'invalid_json', message: 'Request body must be valid JSON.' })
    }

    const authorization = header(event, 'authorization')
    let actor = null
    if (authorization) {
      try {
        actor = await authenticate({ authorization })
      } catch (error) {
        if (error?.status === 401 || error?.status === 403) actor = null
        else return jsonResponse(500, { code: 'auth_error', message: 'Could not validate the MediQo session.' })
      }
      if (!actor) return jsonResponse(401, { code: 'invalid_session', message: 'Your MediQo session is no longer valid. Please sign in again.' })
    }

    let server
    try {
      server = createServer()
    } catch {
      return jsonResponse(500, { code: 'server_not_configured', message: 'MediQo server configuration is incomplete.' })
    }

    const cookies = parseCookies(header(event, 'cookie'))
    let anonymousToken = cookies[ANONYMOUS_COOKIE_NAME] || ''
    let newAnonymousToken = false
    if (!actor && !anonymousToken) {
      anonymousToken = randomTokenFn()
      newAnonymousToken = true
    }

    let anonymousTokenHash = null
    try {
      if (anonymousToken) anonymousTokenHash = await hashFn(anonymousToken)
      if (actor) {
        actor = { ...actor, safetyIdentifier: await hashFn(`mediqo-user:${actor.userId}`) }
        if (anonymousTokenHash) await server.claimAnonymous(anonymousTokenHash, actor.userId, actor.practiceId)
      }

      const result = await processAskFn({
        question: body.question,
        conversationId: body.conversationId || null,
        actor,
        anonymousTokenHash,
      }, {
        reserveAnonymous: (tokenHash) => server.reserveAnonymous(tokenHash),
        completeAnonymous: (sessionId) => server.completeAnonymous(sessionId),
        releaseAnonymous: (sessionId) => server.releaseAnonymous(sessionId),
        persistAnswer: (payload) => server.persistAnswer(payload),
        generateAnswer,
      })

      const headers = {}
      if (newAnonymousToken) {
        headers['Set-Cookie'] = buildCookie(ANONYMOUS_COOKIE_NAME, anonymousToken, {
          secure: isSecureRequest(event),
          maxAge: 31536000,
        })
      } else if (actor && anonymousToken) {
        headers['Set-Cookie'] = buildCookie(ANONYMOUS_COOKIE_NAME, '', {
          secure: isSecureRequest(event),
          maxAge: 0,
        })
      }
      return jsonResponse(result.statusCode, result.body, headers)
    } catch (error) {
      console.error('MediQo ask failed:', error?.message || error)
      return jsonResponse(500, { code: 'assistant_error', message: 'MediQo could not prepare an answer. Please try again.' })
    }
  }
}

export const handler = createAskHandler()
