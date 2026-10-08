import { demoQuestions } from '../data/demo-questions.js'
import { matchDemoQuestion } from '../lib/question-matcher.js'
import { integrationConfig } from './integration-config.js'
import { getSupabaseClient } from './supabase-client.js'

export function createAssistantService({
  config = integrationConfig,
  clientProvider = getSupabaseClient,
  fetchImpl = fetch,
  matchQuestion = (question) => matchDemoQuestion(question, demoQuestions),
} = {}) {
  const live = Boolean(String(config.assistantApiUrl || '').trim())

  return {
    isLive: () => live,

    async ask(question, context = {}) {
      const cleanQuestion = String(question || '').trim()
      if (!live) {
        await delay(context.fast ? 0 : 280)
        if (cleanQuestion.includes('[simulate-error]')) throw new Error('Simulated assistant failure')
        return { answer: matchQuestion(cleanQuestion), question: cleanQuestion }
      }

      let token = ''
      try {
        const client = await clientProvider()
        const { data } = await client.auth.getSession()
        token = data?.session?.access_token || ''
      } catch {
        token = ''
      }

      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const response = await fetchImpl(config.assistantApiUrl, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ question: cleanQuestion, conversationId: context.conversationId || null }),
      })
      const body = await response.json().catch(() => ({}))

      if (response.status === 403 && body?.code === 'signup_required') {
        return {
          signupRequired: true,
          message: body.message || 'Create a free account to keep asking questions.',
          remainingFreeAnswers: Number(body.remainingFreeAnswers ?? 0),
        }
      }
      if (response.status === 401) throw new Error('Your MediQo session has expired. Please sign in again.')
      if (!response.ok) throw new Error(body?.message || 'MediQo could not prepare an answer. Please try again.')
      return body
    },
  }
}

export const assistantService = createAssistantService()

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
