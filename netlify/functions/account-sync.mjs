import { authenticateUser, createSupabaseServer } from './_shared/supabase-server.mjs'
import { syncHubSpotContact } from './_shared/hubspot.mjs'
import { ANONYMOUS_COOKIE_NAME, jsonResponse, parseCookies, sha256Hex } from './_shared/http.mjs'

function header(event, name) {
  const headers = event?.headers || {}
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || ''
}

export function createAccountSyncHandler({
  env = process.env,
  authenticate = ({ authorization }) => authenticateUser({ authorization, env }),
  createServer = () => createSupabaseServer({ env }),
  syncContact = ({ token, contact }) => syncHubSpotContact({ token, contact }),
  hashFn = sha256Hex,
} = {}) {
  return async function handler(event = {}) {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'POST') {
      return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' }, { Allow: 'POST' })
    }

    const authorization = header(event, 'authorization')
    if (!authorization) return jsonResponse(401, { code: 'authentication_required', message: 'Sign in to MediQo first.' })

    let actor
    try {
      actor = await authenticate({ authorization })
    } catch {
      actor = null
    }
    if (!actor) return jsonResponse(401, { code: 'invalid_session', message: 'Your MediQo session is no longer valid. Please sign in again.' })

    let server
    try {
      server = createServer()
    } catch {
      return jsonResponse(500, { code: 'server_not_configured', message: 'MediQo server configuration is incomplete.' })
    }

    try {
      const cookies = parseCookies(header(event, 'cookie'))
      const anonymousToken = cookies[ANONYMOUS_COOKIE_NAME] || ''
      if (anonymousToken) {
        const tokenHash = await hashFn(anonymousToken)
        await server.claimAnonymous(tokenHash, actor.userId, actor.practiceId)
      }

      const contact = {
        email: actor.email,
        firstname: actor.firstName,
        lastname: actor.lastName,
        jobtitle: actor.jobTitle,
        company: actor.practiceName,
      }
      const job = await server.upsertCrmJob({
        userId: actor.userId,
        practiceId: actor.practiceId,
        eventType: 'platform_signup',
        payload: contact,
      })

      let result
      try {
        result = await syncContact({ token: env.HUBSPOT_ACCESS_TOKEN, contact })
      } catch (error) {
        if (job?.id) {
          await server.updateCrmJob(job.id, {
            status: 'failed',
            attempt_count: Number(job.attempt_count || 0) + 1,
            last_attempt_at: new Date().toISOString(),
            last_error: String(error?.message || 'HubSpot sync failed').slice(0, 1000),
          })
        }
        return jsonResponse(202, { status: 'queued', crmSync: 'failed_retryable' })
      }

      if (result?.status !== 'synced') {
        return jsonResponse(202, { status: 'queued', crmSync: result?.reason || 'hubspot_not_configured' })
      }

      if (job?.id) {
        await server.updateCrmJob(job.id, {
          status: 'synced',
          attempt_count: Number(job.attempt_count || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: null,
        })
      }
      return jsonResponse(200, { status: 'synced', contactId: result.contactId || null })
    } catch (error) {
      console.error('MediQo account sync failed:', error?.message || error)
      return jsonResponse(202, { status: 'queued', crmSync: 'retryable' })
    }
  }
}

export const handler = createAccountSyncHandler()
