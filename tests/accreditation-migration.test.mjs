import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const foundationUrl = new URL('../supabase/migrations/202610090002_accreditation_foundation.sql', import.meta.url)
const datasetUrl = new URL('../supabase/migrations/202610090003_accreditation_racgp5_dataset.sql', import.meta.url)
const generatorUrl = new URL('../scripts/generate-accreditation-sql.mjs', import.meta.url)

function read(url) {
  return fs.existsSync(url) ? fs.readFileSync(url, 'utf8') : ''
}

test('accreditation migrations and SQL generator exist', () => {
  assert.equal(fs.existsSync(foundationUrl), true)
  assert.equal(fs.existsSync(datasetUrl), true)
  assert.equal(fs.existsSync(generatorUrl), true)
})

test('foundation creates controlled and practice-scoped accreditation tables', () => {
  const sql = read(foundationUrl)
  for (const table of [
    'accreditation_standard_versions',
    'accreditation_requirements',
    'accreditation_questions',
    'accreditation_answer_options',
    'accreditation_branching_rules',
    'accreditation_evidence_criteria',
    'accreditation_sources',
    'accreditation_cycles',
    'practice_requirements',
    'readiness_responses',
  ]) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`, 'i'))
  }
})

test('foundation constrains approved readiness and verification states', () => {
  const sql = read(foundationUrl)
  for (const state of ['APPEARS_READY', 'NEEDS_ATTENTION', 'CONFIRMED_GAP', 'NOT_CHECKED']) {
    assert.match(sql, new RegExp(state))
  }
  for (const state of ['USER_REPORTED', 'EVIDENCE_UPLOADED', 'AI_REVIEWED', 'MANUALLY_VERIFIED']) {
    assert.match(sql, new RegExp(state))
  }
})

test('practice accreditation tables use RLS and existing membership helpers', () => {
  const sql = read(foundationUrl)
  for (const table of ['accreditation_cycles', 'practice_requirements', 'readiness_responses']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(sql, /is_practice_member\s*\(/i)
  assert.match(sql, /has_practice_role\s*\(/i)
})

test('controlled accreditation configuration is authenticated-readable without browser write policies', () => {
  const sql = read(foundationUrl)
  assert.match(sql, /for select\s+to authenticated/i)
  assert.doesNotMatch(sql, /accreditation_requirements[^;]+for insert\s+to authenticated/is)
  assert.doesNotMatch(sql, /accreditation_requirements[^;]+for update\s+to authenticated/is)
  assert.doesNotMatch(sql, /accreditation_requirements[^;]+for delete\s+to authenticated/is)
})

test('RACGP5 migrations seed current workspace and keep HOLD inactive', () => {
  const foundation = read(foundationUrl)
  const dataset = read(datasetUrl)
  assert.match(foundation, /RACGP5/i)
  assert.match(foundation, /RACGP Standards for general practices/i)
  assert.match(foundation, /5th edition/i)
  assert.match(dataset, /RACGP5-QI2-1C/i)
  assert.match(dataset, /'HOLD'/i)
  assert.match(dataset, /false/i)
  assert.match(dataset, /UNVERIFIED/i)
})
