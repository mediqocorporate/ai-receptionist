export function readIntegrationConfig(source = globalThis.__MEDIQO_CONFIG__ || {}) {
  return Object.freeze({
    supabaseUrl: String(source.supabaseUrl || '').trim(),
    supabaseAnonKey: String(source.supabaseAnonKey || '').trim(),
    appUrl: String(source.appUrl || '').trim(),
  })
}

export function hasSupabaseConfig(config = integrationConfig) {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

export const integrationConfig = readIntegrationConfig()
