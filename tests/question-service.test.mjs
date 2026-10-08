import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuestionService } from '../src/services/question-service.js'

test('authenticated question history loads newest rows then maps them into chronological UI history', async () => {
  const rows = [
    { id: 'q2', question: 'Second', answer_json: { id: 'a2' }, created_at: '2026-10-09T02:00:00Z' },
    { id: 'q1', question: 'First', answer_json: { id: 'a1' }, created_at: '2026-10-09T01:00:00Z' },
  ]
  const calls = []
  const query = {
    select(value) { calls.push(['select', value]); return this },
    order(column, options) { calls.push(['order', column, options]); return this },
    async limit(value) { calls.push(['limit', value]); return { data: rows, error: null } },
  }
  const service = createQuestionService({ clientProvider: async () => ({ from: (table) => { calls.push(['from', table]); return query } }) })
  assert.deepEqual(await service.loadRecent(12), [
    { question: 'First', answerId: 'a1', askedAt: '2026-10-09T01:00:00Z' },
    { question: 'Second', answerId: 'a2', askedAt: '2026-10-09T02:00:00Z' },
  ])
  assert.deepEqual(calls[0], ['from', 'question_logs'])
  assert.deepEqual(calls.at(-1), ['limit', 12])
})
