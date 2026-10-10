export function readIntegrationConfig(source = globalThis.__MEDIQO_CONFIG__ || {}) {
  return Object.freeze({
    supabaseUrl: String(source.supabaseUrl || '').trim(),
    supabaseAnonKey: String(source.supabaseAnonKey || '').trim(),
    appUrl: String(source.appUrl || '').trim(),
    assistantApiUrl: String(source.assistantApiUrl || '').trim(),
    accountSyncApiUrl: String(source.accountSyncApiUrl || '').trim(),
    accreditationApiUrl: String(source.accreditationApiUrl || '').trim(),
    accreditationEvidenceApiUrl: String(source.accreditationEvidenceApiUrl || '').trim(),
    accreditationActionsApiUrl: String(source.accreditationActionsApiUrl || '').trim(),
  })
}

export function hasSupabaseConfig(config = integrationConfig) {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

export const integrationConfig = readIntegrationConfig()
