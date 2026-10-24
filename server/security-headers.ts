import { randomBytes } from 'node:crypto'
import { setHeader, type H3Event } from 'h3'

export function setSecurityHeaders(event: H3Event, origin: string) {
  const nonce = randomBytes(24).toString('base64')
  event.context.scriptNonce = nonce
  const script = import.meta.dev ? "'self' 'unsafe-inline' 'unsafe-eval'" : `'self' 'nonce-${nonce}'`
  const connect = import.meta.dev ? "'self' ws: wss:" : "'self'"
  setHeader(event, 'Content-Security-Policy', [
    "default-src 'none'", `script-src ${script}`, "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "font-src 'self'", `connect-src ${connect}`, "manifest-src 'self'",
    "base-uri 'none'", "object-src 'none'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; '))
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  if (origin.startsWith('https:')) setHeader(event, 'Strict-Transport-Security', 'max-age=31536000')
}
