import { getSupabaseClient, isSupabaseConfigured } from './supabase-client.js'

function asMessage(error, fallback) {
  return String(error?.message || fallback)
}

function metadataFallback(authUser, overrides = {}) {
  const metadata = authUser?.user_metadata || {}
  return {
    id: authUser?.id || '',
    email: authUser?.email || overrides.email || '',
    firstName: overrides.firstName ?? metadata.first_name ?? '',
    lastName: overrides.lastName ?? metadata.last_name ?? '',
    jobTitle: overrides.jobTitle ?? metadata.job_title ?? '',
    practiceId: overrides.practiceId ?? '',
    clinicName: overrides.clinicName ?? metadata.practice_name ?? '',
    locations: overrides.locations ?? metadata.jurisdictions ?? [],
    role: overrides.role ?? '',
    requiresEmailConfirmation: Boolean(overrides.requiresEmailConfirmation),
  }
}

async function hydrateUser(client, authUser, fallback = {}) {
  if (!authUser) return null
  const { data, error } = await client.rpc('get_current_account_context')
  if (error) throw new Error(asMessage(error, 'Could not load your MediQo practice.'))
  const context = Array.isArray(data) ? data[0] : data
  if (!context) return metadataFallback(authUser, fallback)

  return metadataFallback(authUser, {
    ...fallback,
    firstName: context.first_name || fallback.firstName,
    lastName: context.last_name || fallback.lastName,
    jobTitle: context.job_title || fallback.jobTitle,
    practiceId: context.practice_id || '',
    clinicName: context.practice_name || fallback.clinicName,
    locations: Array.isArray(context.jurisdictions) ? context.jurisdictions : fallback.locations,
    role: context.role || '',
    requiresEmailConfirmation: false,
  })
}

export function createAuthService({
  clientProvider = getSupabaseClient,
  configured = isSupabaseConfigured,
} = {}) {
  return {
    isConfigured: () => configured(),

    async createAccount(payload) {
      const client = await clientProvider()
      const metadata = {
        account_kind: 'practice_signup',
        first_name: String(payload.firstName || '').trim(),
        last_name: String(payload.lastName || '').trim(),
        job_title: String(payload.jobTitle || '').trim(),
        practice_name: String(payload.clinicName || '').trim(),
        jurisdictions: Array.isArray(payload.locations) ? payload.locations : [],
      }

      const { data, error } = await client.auth.signUp({
        email: String(payload.email || '').trim(),
        password: String(payload.password || ''),
        options: { data: metadata },
      })

      if (error) throw new Error(asMessage(error, 'Could not create account. Please try again.'))
      if (!data?.user) throw new Error('Supabase did not return a user account. Please try again.')

      if (!data.session) {
        return metadataFallback(data.user, {
          firstName: metadata.first_name,
          lastName: metadata.last_name,
          jobTitle: metadata.job_title,
          clinicName: metadata.practice_name,
          locations: metadata.jurisdictions,
          requiresEmailConfirmation: true,
        })
      }

      return hydrateUser(client, data.user, {
        firstName: metadata.first_name,
        lastName: metadata.last_name,
        jobTitle: metadata.job_title,
        clinicName: metadata.practice_name,
        locations: metadata.jurisdictions,
      })
    },

    async signIn({ email, password }) {
      const client = await clientProvider()
      const { data, error } = await client.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || ''),
      })
      if (error) throw new Error(asMessage(error, 'Could not sign in. Check your email and password.'))
      return hydrateUser(client, data?.user || data?.session?.user)
    },

    async getCurrentUser() {
      if (!configured()) return null
      const client = await clientProvider()
      const { data, error } = await client.auth.getSession()
      if (error) throw new Error(asMessage(error, 'Could not restore your MediQo session.'))
      if (!data?.session?.user) return null
      return hydrateUser(client, data.session.user)
    },

    async signOut() {
      if (!configured()) return
      const client = await clientProvider()
      const { error } = await client.auth.signOut()
      if (error) throw new Error(asMessage(error, 'Could not sign out. Please try again.'))
    },

    async onAuthStateChange(callback) {
      if (!configured()) return { unsubscribe() {} }
      const client = await clientProvider()
      const { data } = client.auth.onAuthStateChange(async (_event, session) => {
        const user = session?.user ? await hydrateUser(client, session.user) : null
        callback(user)
      })
      return data?.subscription || { unsubscribe() {} }
    },
  }
}

export const authService = createAuthService()
