import { hasSupabaseConfig, integrationConfig } from './integration-config.js'

const SUPABASE_ESM_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
let defaultClientPromise = null

export function isSupabaseConfigured(config = integrationConfig) {
  return hasSupabaseConfig(config)
}

export async function createSupabaseClient({
  config = integrationConfig,
  moduleLoader = () => import(SUPABASE_ESM_URL),
} = {}) {
  if (!isSupabaseConfigured(config)) {
    throw new Error('MediQo account services are not configured yet. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to your local environment.')
  }

  const { createClient } = await moduleLoader()
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export function getSupabaseClient() {
  if (!defaultClientPromise) defaultClientPromise = createSupabaseClient()
  return defaultClientPromise
}

export function resetSupabaseClientForTests() {
  defaultClientPromise = null
}
