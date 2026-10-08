import { integrationConfig } from './integration-config.js'
import { getSupabaseClient } from './supabase-client.js'

async function bearerToken(clientProvider) {
  const client = await clientProvider()
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(error.message || 'Could not read your MediQo session.')
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in to use the Accreditation Assistant.')
  return token
}

export function createAccreditationService({
  config = integrationConfig,
  clientProvider = getSupabaseClient,
  fetchImpl = fetch,
} = {}) {
  async function request(payload) {
    const url = String(config.accreditationApiUrl || '').trim()
    if (!url) throw new Error('MediQo accreditation services are not configured yet.')
    const token = await bearerToken(clientProvider)
    const response = await fetchImpl(url, {
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
      const error = new Error(body?.message || 'MediQo could not load accreditation readiness. Please try again.')
      error.code = body?.code || 'accreditation_error'
      error.status = response.status
      throw error
    }
    return body
  }

  return {
    isLive() {
      return Boolean(String(config.accreditationApiUrl || '').trim())
    },

    async overview() {
      const body = await request({ action: 'overview' })
      return body.overview
    },

    async answer({ cycleId, questionId, answerLabel, answerDetail = {} }) {
      return request({ action: 'answer', cycleId, questionId, answerLabel, answerDetail })
    },

    async requirement({ requirementId, cycleId }) {
      const body = await request({ action: 'requirement', requirementId, cycleId })
      return body.requirement
    },
  }
}

export const accreditationService = createAccreditationService()
