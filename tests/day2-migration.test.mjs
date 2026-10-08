import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../supabase/migrations/202610090001_question_persistence_and_quota.sql', import.meta.url), 'utf8')

test('day-two migration creates persisted Q&A, anonymous quota and CRM queue tables', () => {
  for (const table of ['anonymous_sessions', 'conversations', 'messages', 'question_logs', 'answer_sources', 'crm_sync_jobs']) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, 'i'))
  }
  for (const fn of ['reserve_anonymous_answer', 'complete_anonymous_answer', 'release_anonymous_answer', 'claim_anonymous_session', 'persist_question_answer']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}`, 'i'))
  }
  assert.match(sql, /successful_answer_count\s+smallint/i)
  assert.match(sql, /reserved_answer_count\s+smallint/i)
  assert.match(sql, /enable row level security/gi)
  assert.match(sql, /claimed_by_user_id is not null[\s\S]*anonymous_session_already_claimed/i)
})
