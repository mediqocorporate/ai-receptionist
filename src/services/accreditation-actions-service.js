import { integrationConfig } from './integration-config.js'
import { getSupabaseClient } from './supabase-client.js'

async function bearerToken(clientProvider) {
  const client = await clientProvider()
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(error.message || 'Could not read your MediQo session.')
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in to manage accreditation actions.')
  return token
}

export function createAccreditationActionsService({
  config = integrationConfig,
  clientProvider = getSupabaseClient,
  fetchImpl = fetch,
} = {}) {
  const endpoint = String(config.accreditationActionsApiUrl || '/api/accreditation-actions').trim()

  async function request(payload) {
    if (!endpoint) throw new Error('MediQo accreditation action services are not configured yet.')
    const token = await bearerToken(clientProvider)
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(body?.message || 'MediQo could not manage accreditation actions. Please try again.')
      error.code = body?.code || 'accreditation_actions_error'
      error.status = response.status
      throw error
    }
    return body
  }

  return {
    isLive() {
      return Boolean(endpoint)
    },

    async list({ cycleId }) {
      const body = await request({ action: 'list', cycleId })
      return body.actions || { items: [], owners: [], summary: {} }
    },

    async create({ cycleId, action }) {
      const body = await request({ action: 'create', cycleId, item: action || {} })
      return body.action
    },

    async update({ cycleId, actionId, patch }) {
      const body = await request({ action: 'update', cycleId, actionId, patch: patch || {} })
      return body.action
    },
  }
}

export const accreditationActionsService = createAccreditationActionsService()
