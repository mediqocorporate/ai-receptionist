import { authenticateUser, createSupabaseServer } from './_shared/supabase-server.mjs'
import { jsonResponse, parseJsonBody } from './_shared/http.mjs'
import { createPolicyDraft } from './_shared/policy-openai.mjs'

function header(event, name) {
  const headers = event?.headers || {}
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || ''
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

export function createPolicyDocumentHandler({
  env = process.env,
  authenticate = ({ authorization }) => authenticateUser({ authorization, env }),
  createServer = () => createSupabaseServer({ env }),
  generateDraft = (input) => createPolicyDraft(input),
} = {}) {
  return async function handler(event = {}) {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'POST') {
      return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' }, { Allow: 'POST' })
    }

    let body
    try { body = parseJsonBody(event) } catch {
      return jsonResponse(400, { code: 'invalid_json', message: 'Request body must be valid JSON.' })
    }

    const authorization = header(event, 'authorization')
    if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) {
      return jsonResponse(401, { code: 'authentication_required', message: 'Sign in to create practice documents.' })
    }

    let actor
    try { actor = await authenticate({ authorization }) } catch (error) {
      if (error?.status === 401 || error?.status === 403) actor = null
      else {
        console.error('MediQo policy document auth failed:', error?.message || error)
        return jsonResponse(500, { code: 'auth_error', message: 'Could not validate the MediQo session.' })
      }
    }
    if (!actor?.userId || !actor?.practiceId) {
      return jsonResponse(401, { code: 'invalid_session', message: 'Your MediQo session is no longer valid. Please sign in again.' })
    }

    let server
    try { server = createServer() } catch (error) {
      console.error('MediQo policy document server setup failed:', error?.message || error)
      return jsonResponse(500, { code: 'server_not_configured', message: 'MediQo document services are not configured.' })
    }

    const action = cleanText(body.action, 40)
    try {
      if (action === 'list') {
        const documents = await server.listPracticeDocuments(actor.practiceId)
        return jsonResponse(200, { documents })
      }

      if (action === 'generate') {
        const documentType = cleanText(body.documentType, 240)
        const considerations = cleanText(body.considerations, 5000)
        const templateContext = cleanText(body.templateContext, 8000)
        if (documentType.length < 2) {
          return jsonResponse(400, { code: 'document_type_required', message: 'Tell MediQo what document you want to create.' })
        }
        const practice = await server.getPracticeSummary(actor.practiceId)
        const draft = await generateDraft({
          apiKey: env.OPENAI_API_KEY,
          model: env.OPENAI_MODEL || 'gpt-6-luna',
          practiceName: practice?.name || 'Your practice',
          documentType,
          considerations,
          templateContext,
        })
        return jsonResponse(200, { draft })
      }

      if (action === 'save') {
        const title = cleanText(body.title, 240)
        const documentType = cleanText(body.documentType, 240)
        const considerations = cleanText(body.considerations, 5000)
        const content = cleanText(body.content, 100000)
        if (title.length < 2 || documentType.length < 2 || content.length < 20) {
          return jsonResponse(400, { code: 'document_invalid', message: 'A title, document type and document content are required.' })
        }
        const document = await server.savePracticeDocument({
          practiceId: actor.practiceId,
          userId: actor.userId,
          title,
          documentType,
          considerations,
          content,
          sourceTemplateId: cleanText(body.sourceTemplateId, 120) || null,
          linkedRequirementIds: Array.isArray(body.linkedRequirementIds)
            ? body.linkedRequirementIds.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 50)
            : [],
        })
        return jsonResponse(200, { document })
      }

      return jsonResponse(400, { code: 'invalid_action', message: 'Choose list, generate or save.' })
    } catch (error) {
      console.error('MediQo policy document failed:', error?.message || error)
      return jsonResponse(500, { code: 'policy_document_error', message: 'MediQo could not complete that document request. Please try again.' })
    }
  }
}

export const handler = createPolicyDocumentHandler()
