import { createHash, randomBytes } from 'node:crypto'

export const ANONYMOUS_COOKIE_NAME = 'mediqo_anon'

export function parseCookies(cookieHeader = '') {
  const cookies = {}
  for (const part of String(cookieHeader).split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const index = trimmed.indexOf('=')
    const key = index >= 0 ? trimmed.slice(0, index) : trimmed
    const raw = index >= 0 ? trimmed.slice(index + 1) : ''
    try { cookies[key] = decodeURIComponent(raw) } catch { cookies[key] = raw }
  }
  return cookies
}

export function buildCookie(name, value, { secure = true, maxAge = 31536000 } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Number(maxAge) || 0)}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function randomToken() {
  return randomBytes(32).toString('base64url')
}

export async function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

export function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(body),
  }
}

export function parseJsonBody(event = {}) {
  if (!event.body) return {}
  try { return JSON.parse(event.body) } catch { throw new Error('invalid_json') }
}

export function isSecureRequest(event = {}) {
  const protocol = event.headers?.['x-forwarded-proto'] || event.headers?.['X-Forwarded-Proto']
  if (protocol) return String(protocol).split(',')[0].trim().toLowerCase() === 'https'
  const host = event.headers?.host || event.headers?.Host || ''
  return !/^localhost(?::|$)|^127\.0\.0\.1(?::|$)/i.test(String(host))
}
