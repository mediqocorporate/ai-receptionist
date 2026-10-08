import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationUrl = new URL('../supabase/migrations/202610090004_accreditation_onboarding.sql', import.meta.url)

test('accreditation onboarding migration stores practice setup with tenant-safe read access', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /create table public\.accreditation_agencies/i)
  assert.match(sql, /create table public\.accreditation_practice_profiles/i)
  for (const column of ['practice_id','journey_status','assessment_scheduled','accrediting_agency_id','practice_context','fact_provenance','created_at','updated_at']) {
    assert.match(sql, new RegExp('\\b' + column + '\\b', 'i'))
  }
  assert.match(sql, /alter table public\.accreditation_practice_profiles enable row level security/i)
  assert.match(sql, /for select to authenticated[\s\S]*is_practice_member\(practice_id\)/i)
  assert.doesNotMatch(sql, /create policy[\s\S]{0,140}accreditation_practice_profiles[\s\S]{0,140}for (?:insert|update|delete) to authenticated/i)
  assert.doesNotMatch(sql, /insert into public\.accreditation_agencies/i)
})
