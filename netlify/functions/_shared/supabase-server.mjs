function readConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '')
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '')
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '')
  if (!url || !publishableKey) throw new Error('Supabase public server configuration is missing.')
  return { url, publishableKey, serviceRoleKey }
}

async function parseJson(response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body?.message || body?.error_description || body?.error || `Supabase request failed with status ${response.status}.`
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return body
}

export async function authenticateUser({ authorization, env = process.env, fetchImpl = fetch }) {
  if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) return null
  const { url, publishableKey } = readConfig(env)
  const headers = { apikey: publishableKey, Authorization: authorization, 'Content-Type': 'application/json' }

  const userResponse = await fetchImpl(`${url}/auth/v1/user`, { method: 'GET', headers })
  if (userResponse.status === 401 || userResponse.status === 403) return null
  const user = await parseJson(userResponse)

  const contextResponse = await fetchImpl(`${url}/rest/v1/rpc/get_current_account_context`, {
    method: 'POST',
    headers,
    body: '{}',
  })
  const contextRows = await parseJson(contextResponse)
  const context = Array.isArray(contextRows) ? contextRows[0] : contextRows
  if (!context?.practice_id) throw new Error('Authenticated MediQo user has no active practice membership.')

  return {
    userId: user.id,
    email: user.email || '',
    firstName: context.first_name || '',
    lastName: context.last_name || '',
    jobTitle: context.job_title || '',
    practiceId: context.practice_id,
    practiceName: context.practice_name || '',
    role: context.role || '',
    jurisdictions: Array.isArray(context.jurisdictions) ? context.jurisdictions : [],
  }
}

export function createSupabaseServer({ env = process.env, fetchImpl = fetch } = {}) {
  const config = readConfig(env)
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  const serviceHeaders = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    'Content-Type': 'application/json',
  }

  async function rpc(name, payload = {}) {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify(payload),
    })
    return parseJson(response)
  }

  async function table(path, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
      method,
      headers: { ...serviceHeaders, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return parseJson(response)
  }

  return {
    async reserveAnonymous(tokenHash) {
      const rows = await rpc('reserve_anonymous_answer', { p_token_hash: tokenHash })
      const row = Array.isArray(rows) ? rows[0] : rows
      return {
        sessionId: row?.session_id || null,
        allowed: Boolean(row?.allowed),
        remaining: Number(row?.remaining_after_reservation ?? 0),
      }
    },

    async completeAnonymous(sessionId) {
      const rows = await rpc('complete_anonymous_answer', { p_session_id: sessionId })
      const row = Array.isArray(rows) ? rows[0] : rows
      return { successfulCount: Number(row?.successful_count ?? 0), remaining: Number(row?.remaining ?? 0) }
    },

    async releaseAnonymous(sessionId) {
      await rpc('release_anonymous_answer', { p_session_id: sessionId })
    },

    async claimAnonymous(tokenHash, userId, practiceId) {
      return rpc('claim_anonymous_session', { p_token_hash: tokenHash, p_user_id: userId, p_practice_id: practiceId })
    },

    async persistAnswer({ conversationId, userId, practiceId, anonymousSessionId, question, answerText, answerJson, model, responseId }) {
      const rows = await rpc('persist_question_answer', {
        p_conversation_id: conversationId,
        p_user_id: userId,
        p_practice_id: practiceId,
        p_anonymous_session_id: anonymousSessionId,
        p_question: question,
        p_answer_text: answerText,
        p_answer_json: answerJson,
        p_model: model,
        p_openai_response_id: responseId,
      })
      const row = Array.isArray(rows) ? rows[0] : rows
      return { conversationId: row?.conversation_id, questionLogId: row?.question_log_id }
    },

    async upsertCrmJob({ userId, practiceId, eventType, payload }) {
      const rows = await table('crm_sync_jobs?on_conflict=user_id,event_type', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: [{ user_id: userId, practice_id: practiceId, event_type: eventType, payload, status: 'pending' }],
      })
      return Array.isArray(rows) ? rows[0] : rows
    },

    async updateCrmJob(jobId, patch) {
      const rows = await table(`crm_sync_jobs?id=eq.${encodeURIComponent(jobId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: patch,
      })
      return Array.isArray(rows) ? rows[0] : rows
    },
  }
}
