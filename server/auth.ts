import { createError, getCookie, getRequestHeader, setCookie, type H3Event } from 'h3'
import { AccessError, validateAccessConfig, type AccessConfig } from './access-store.ts'
export const sessionCookie = 'vl_owner_session'
export function accessConfig(event?: H3Event): AccessConfig {
  const config = useRuntimeConfig(event)
  return validateAccessConfig({ resetKey: process.env.OWNER_RESET_KEY ?? String(config.ownerResetKey ?? ''), origin: String(config.libraryOrigin) })
}
export function accessHttpError(error: unknown): never {
  if (error instanceof AccessError) throw createError({ statusCode: error.status, statusMessage: error.message })
  throw error
}
export const ownerCookie = (event: H3Event) => getCookie(event, sessionCookie)
export function writeSessionCookie(event: H3Event, token: string, config: AccessConfig) {
  setCookie(event, sessionCookie, token, { httpOnly: true, secure: config.origin.startsWith('https:'), sameSite: 'lax', path: '/', maxAge: token ? 30 * 86400 : 0 })
}
export function requireOwner(event: H3Event) {
  if (event.context.accessIdentity !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Owner access required.' })
}
export function requireSameOrigin(event: H3Event, config: AccessConfig, share = false) {
  const origin = getRequestHeader(event, 'origin'), site = getRequestHeader(event, 'sec-fetch-site')
  if ((site && site !== 'same-origin' && site !== 'none') || (origin !== config.origin && !(share && !origin && site === 'same-origin'))) {
    throw createError({ statusCode: 403, statusMessage: 'Request origin rejected.' })
  }
  if (!share && getRequestHeader(event, 'x-library-request') !== '1') throw createError({ statusCode: 403, statusMessage: 'Request intent required.' })
}
