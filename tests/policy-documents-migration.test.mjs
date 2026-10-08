import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationUrl = new URL('../supabase/migrations/202610090010_policy_documents.sql', import.meta.url)

test('policy document migration creates tenant-scoped persistent documents with server-controlled writes', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /create table public\.practice_documents/i)
  for (const column of ['practice_id','user_id','title','document_type','considerations','content','version','status','source_template_id','linked_requirement_ids','created_at','updated_at']) {
    assert.match(sql, new RegExp('\\b' + column + '\\b', 'i'))
  }
  assert.match(sql, /alter table public\.practice_documents enable row level security/i)
  assert.match(sql, /for select to authenticated[\s\S]*is_practice_member\(practice_id\)/i)
  assert.doesNotMatch(sql, /create policy[\s\S]{0,120}practice_documents[\s\S]{0,120}for (?:insert|update|delete) to authenticated/i)
})
