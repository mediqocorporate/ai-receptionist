import { integrationConfig } from './integration-config.js'
import { getSupabaseClient } from './supabase-client.js'

export function createLeadService({
  config = integrationConfig,
  clientProvider = getSupabaseClient,
  fetchImpl = fetch,
} = {}) {
  return {
    async submit(payload) {
      await new Promise((resolve) => setTimeout(resolve, 80))
      return { status: 'demo', email: payload.email }
    },

    async syncPlatformAccount() {
      const url = String(config.accountSyncApiUrl || '').trim()
      if (!url) return { status: 'skipped' }
      try {
        const client = await clientProvider()
        const { data } = await client.auth.getSession()
        const token = data?.session?.access_token || ''
        if (!token) return { status: 'skipped' }
        const response = await fetchImpl(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: '{}',
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok && response.status !== 202) return { status: 'queued' }
        return { status: body?.status === 'synced' ? 'synced' : 'queued' }
      } catch {
        return { status: 'queued' }
      }
    },
  }
}

export const leadService = createLeadService()
