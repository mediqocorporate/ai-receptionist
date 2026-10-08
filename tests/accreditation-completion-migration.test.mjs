import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationUrl = new URL('../supabase/migrations/202610090005_accreditation_completion_foundation.sql', import.meta.url)

test('accreditation completion migration creates the evidence, work, AI, report and knowledge entities', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  for (const table of [
    'accreditation_evidence',
    'accreditation_evidence_requirement_links',
    'accreditation_evidence_assessments',
    'accreditation_processing_jobs',
    'accreditation_actions',
    'accreditation_team_members',
    'accreditation_credentials',
    'accreditation_training_records',
    'accreditation_ai_conversations',
    'accreditation_ai_messages',
    'accreditation_ai_citations',
    'accreditation_review_snapshots',
    'accreditation_readiness_reports',
    'knowledge_sources',
    'knowledge_chunks',
  ]) {
    assert.match(sql, new RegExp('create table public\\.' + table, 'i'), table)
  }
})

test('evidence and actions use controlled lifecycle states and evidence mapping is many-to-many', () => {
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /status text[^;]+ACTIVE[^;]+SUPERSEDED[^;]+ARCHIVED/i)
  for (const value of ['SUFFICIENT_FOR_REVIEW','INCOMPLETE','OUTDATED','CONFLICTING','NOT_REVIEWED','MORE_INFORMATION_REQUIRED']) {
    assert.match(sql, new RegExp(value))
  }
  for (const value of ['OPEN','IN_PROGRESS','BLOCKED','DONE']) {
    assert.match(sql, new RegExp(value))
  }
  assert.match(sql, /unique\s*\(evidence_id,\s*requirement_id\)/i)
})

test('practice-scoped completion tables have RLS member reads without authenticated browser writes', () => {
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  const privateTables = [
    'accreditation_evidence',
    'accreditation_evidence_requirement_links',
    'accreditation_evidence_assessments',
    'accreditation_processing_jobs',
    'accreditation_actions',
    'accreditation_team_members',
    'accreditation_credentials',
    'accreditation_training_records',
    'accreditation_ai_conversations',
    'accreditation_ai_messages',
    'accreditation_ai_citations',
    'accreditation_review_snapshots',
    'accreditation_readiness_reports',
  ]
  for (const table of privateTables) {
    assert.match(sql, new RegExp('alter table public\\.' + table + ' enable row level security', 'i'), table)
    assert.match(sql, new RegExp('create policy ' + table + '_select_member[\\s\\S]*?for select to authenticated[\\s\\S]*?is_practice_member\\(practice_id\\)', 'i'), table)
    assert.doesNotMatch(sql, new RegExp('create policy[^;]*' + table + '[^;]*for (?:insert|update|delete) to authenticated', 'i'), table)
  }
})

test('knowledge storage uses reviewed/active governance, pgvector and server-only vector matching', () => {
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /create extension if not exists vector/i)
  assert.match(sql, /knowledge_sources[\s\S]*is_reviewed boolean/i)
  assert.match(sql, /knowledge_sources[\s\S]*is_active boolean/i)
  assert.match(sql, /scope text[\s\S]*GLOBAL_APPROVED[\s\S]*PRACTICE_PRIVATE/i)
  assert.match(sql, /embedding extensions\.vector\(3072\)/i)
  assert.match(sql, /create or replace function public\.match_accreditation_knowledge/i)
  assert.match(sql, /revoke all on function public\.match_accreditation_knowledge/i)
  assert.match(sql, /grant execute on function public\.match_accreditation_knowledge[^;]+to service_role/i)
})

test('accreditation evidence Storage bucket is private and limited at the database configuration layer', () => {
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /insert into storage\.buckets/i)
  assert.match(sql, /accreditation-evidence/)
  assert.match(sql, /public[^\n]+false/i)
  assert.match(sql, /10485760/)
  for (const mime of ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg']) {
    assert.match(sql, new RegExp(mime.replace(/[.*+?^$()|[\]\\]/g, '\\$&')))
  }
})

test('no completion migration seeds unapproved accrediting or regulatory source content', () => {
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.doesNotMatch(sql, /insert into public\.knowledge_sources/i)
  assert.doesNotMatch(sql, /insert into public\.accreditation_agencies/i)
})
