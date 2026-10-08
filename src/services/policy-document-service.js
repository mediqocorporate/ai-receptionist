import { integrationConfig } from './integration-config.js'
import { getSupabaseClient } from './supabase-client.js'

async function bearerToken(clientProvider) {
  const client = await clientProvider()
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(error.message || 'Could not read your MediQo session.')
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in to create practice documents.')
  return token
}

export function createPolicyDocumentService({
  config = integrationConfig,
  clientProvider = getSupabaseClient,
  fetchImpl = fetch,
} = {}) {
  const endpoint = String(config.policyDocumentApiUrl || '/api/policy-document').trim()

  async function request(payload) {
    if (!endpoint) throw new Error('MediQo document services are not configured yet.')
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
      const error = new Error(body?.message || 'MediQo could not complete that document request.')
      error.code = body?.code || 'policy_document_error'
      error.status = response.status
      throw error
    }
    return body
  }

  return {
    isLive() { return Boolean(endpoint) },
    async list() {
      const body = await request({ action: 'list' })
      return body.documents || []
    },
    async generate({ documentType, considerations = '', templateContext = '' }) {
      const body = await request({ action: 'generate', documentType, considerations, templateContext })
      return body.draft
    },
    async save({ title, documentType, considerations = '', content, sourceTemplateId = null, linkedRequirementIds = [] }) {
      const body = await request({ action: 'save', title, documentType, considerations, content, sourceTemplateId, linkedRequirementIds })
      return body.document
    },
  }
}

export const policyDocumentService = createPolicyDocumentService()
