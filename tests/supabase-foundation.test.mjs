import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sqlPath = new URL('../supabase/migrations/202610080001_phase1_foundation.sql', import.meta.url)

test('phase-one migration creates tenant tables, auth bootstrap and RLS', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8')
  for (const table of ['profiles', 'practices', 'practice_locations', 'practice_memberships']) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, 'i'))
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(sql, /create or replace function public\.handle_new_auth_user/i)
  assert.match(sql, /create trigger on_auth_user_created/i)
  assert.match(sql, /create or replace function public\.is_practice_member/i)
  assert.match(sql, /create or replace function public\.get_current_account_context/i)
  assert.match(sql, /owner.*admin.*practice_manager.*staff/is)
})
