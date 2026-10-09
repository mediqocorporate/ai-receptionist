import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationUrl = new URL('../supabase/migrations/202610090006_accreditation_setup_completion.sql', import.meta.url)

test('setup completion migration allows currently-accredited journey state', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /drop constraint if exists accreditation_practice_profiles_journey_status_check/i)
  assert.match(sql, /CURRENTLY_ACCREDITED/)
  assert.match(sql, /add constraint accreditation_practice_profiles_journey_status_check/i)
})
