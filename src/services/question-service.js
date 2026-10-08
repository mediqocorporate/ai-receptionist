import { getSupabaseClient } from './supabase-client.js'

export function createQuestionService({ clientProvider = getSupabaseClient } = {}) {
  return {
    async loadRecent(limit = 12) {
      const client = await clientProvider()
      const { data, error } = await client
        .from('question_logs')
        .select('id,question,answer_json,created_at')
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(50, Number(limit) || 12)))
      if (error) throw new Error(error.message || 'Could not load MediQo question history.')
      return (data || []).slice().reverse().map((row) => ({
        question: row.question,
        answerId: row.answer_json?.id || row.id,
        askedAt: row.created_at,
      }))
    },
  }
}

export const questionService = createQuestionService()
