import { readFile } from 'node:fs/promises'
import path from 'node:path'

export function parseEnvText(text = '') {
  const env = {}
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index < 1) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

export async function loadEnvironment(rootDir, baseEnv = process.env) {
  const merged = { ...baseEnv }
  for (const filename of ['.env', '.env.local']) {
    try {
      const text = await readFile(path.join(rootDir, filename), 'utf8')
      Object.assign(merged, parseEnvText(text))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  return merged
}

export function publicRuntimeConfig(env = {}) {
  return {
    supabaseUrl: String(env.SUPABASE_URL || '').trim(),
    supabaseAnonKey: String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim(),
    appUrl: String(env.APP_URL || '').trim(),
    assistantApiUrl: String(env.MEDIQO_ASSISTANT_API_URL || '').trim(),
    accountSyncApiUrl: String(env.MEDIQO_ACCOUNT_SYNC_API_URL || '').trim(),
    accreditationApiUrl: String(env.MEDIQO_ACCREDITATION_API_URL || '').trim(),
    accreditationEvidenceApiUrl: String(env.MEDIQO_ACCREDITATION_EVIDENCE_API_URL || '').trim(),
  }
}

export function runtimeConfigScript(env = {}) {
  const config = publicRuntimeConfig(env)
  return `window.__MEDIQO_CONFIG__ = Object.freeze(${JSON.stringify(config)});\n`
}
