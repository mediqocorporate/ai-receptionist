import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthService } from '../src/services/auth-service.js'

function fakeClient({ session = null, context = null } = {}) {
  const calls = { signUp: null, signIn: null, signOut: 0 }
  const client = {
    auth: {
      async signUp(input) {
        calls.signUp = input
        const user = { id: 'user-1', email: input.email, user_metadata: input.options.data }
        return { data: { user, session: { user } }, error: null }
      },
      async signInWithPassword(input) {
        calls.signIn = input
        const user = { id: 'user-1', email: input.email, user_metadata: {} }
        return { data: { user, session: { user } }, error: null }
      },
      async getSession() { return { data: { session }, error: null } },
      async signOut() { calls.signOut += 1; return { error: null } },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } },
    },
    async rpc(name) {
      assert.equal(name, 'get_current_account_context')
      return { data: context ? [context] : [], error: null }
    },
  }
  return { client, calls }
}

test('createAccount uses Supabase Auth metadata and hydrates the practice context', async () => {
  const { client, calls } = fakeClient({ context: {
    first_name: 'Sarah', last_name: 'Jones', job_title: 'Practice Manager',
    practice_id: 'practice-1', practice_name: 'Harbour Family Clinic', jurisdictions: ['NSW'], role: 'owner',
  } })
  const service = createAuthService({ clientProvider: async () => client, configured: () => true })
  const user = await service.createAccount({
    clinicName: 'Harbour Family Clinic', firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager',
    email: 'sarah@example.com', password: 'strongpass', locations: ['NSW'],
  })

  assert.equal(calls.signUp.email, 'sarah@example.com')
  assert.equal(calls.signUp.options.data.account_kind, 'practice_signup')
  assert.equal(calls.signUp.options.data.practice_name, 'Harbour Family Clinic')
  assert.deepEqual(calls.signUp.options.data.jurisdictions, ['NSW'])
  assert.deepEqual(user, {
    id: 'user-1', email: 'sarah@example.com', firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager',
    practiceId: 'practice-1', clinicName: 'Harbour Family Clinic', locations: ['NSW'], role: 'owner', requiresEmailConfirmation: false,
  })
})

test('createAccount preserves a pending email-confirmation state when Supabase returns no session', async () => {
  const client = {
    auth: {
      async signUp(input) {
        return { data: { user: { id: 'user-2', email: input.email, user_metadata: input.options.data }, session: null }, error: null }
      },
    },
  }
  const service = createAuthService({ clientProvider: async () => client, configured: () => true })
  const user = await service.createAccount({
    clinicName: 'Harbour Family Clinic', firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager',
    email: 'sarah@example.com', password: 'strongpass', locations: ['NSW'],
  })
  assert.equal(user.requiresEmailConfirmation, true)
  assert.equal(user.clinicName, 'Harbour Family Clinic')
})

test('getCurrentUser returns null when there is no Supabase session', async () => {
  const { client } = fakeClient({ session: null })
  const service = createAuthService({ clientProvider: async () => client, configured: () => true })
  assert.equal(await service.getCurrentUser(), null)
})
