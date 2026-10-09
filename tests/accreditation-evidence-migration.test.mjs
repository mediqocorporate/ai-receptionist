import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationUrl = new URL('../supabase/migrations/202610100002_accreditation_evidence_upload_limits.sql', import.meta.url)

test('evidence upload migration raises the private bucket and table limit to 25 MB', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /accreditation-evidence/i)
  assert.match(sql, /26214400/)
  assert.match(sql, /drop constraint if exists accreditation_evidence_size_bytes_check/i)
  assert.match(sql, /add constraint accreditation_evidence_size_bytes_check/i)
})

test('evidence upload migration allows only the current client-approved file families', () => {
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  for (const mime of [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
  ]) assert.match(sql, new RegExp(mime.replace(/[.*+?^$()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(sql, /text\/plain/)
})
