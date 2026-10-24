import { createError, getRequestHeader, sendRedirect, setHeader } from 'h3'
import { hasOwnerSession, validApplicationToken } from '../access-store.ts'
import { accessConfig, ownerCookie, requireSameOrigin } from '../auth.ts'

export default defineEventHandler(async event => {
  const config = accessConfig(event)
  const path = event.path.split('?')[0]!, method = event.method
  // Default denial includes unusual encodings and paths that another router may normalize.
  const staticGet = ['GET', 'HEAD'].includes(method) && (/^\/_nuxt\/[\w./-]+$/.test(path) && !path.includes('..') || /^\/icons\/[\w.-]+$/.test(path) || path === '/manifest.webmanifest')
  if (staticGet) return
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  if (['/api/auth/login', '/api/auth/setup'].includes(path) && method === 'POST') { requireSameOrigin(event, config); return }
  if (path === '/api/auth/session' && method === 'GET') return
  if (/^\/shared-images\/[^/]+$/.test(path) && ['GET', 'HEAD'].includes(method)) return
  const authorization = getRequestHeader(event, 'authorization')
  if (authorization !== undefined) {
    const token = /^Bearer (\S+)$/.exec(authorization)?.[1]
    if (!token || !await validApplicationToken(token)) throw createError({ statusCode: 401, statusMessage: 'Invalid integration credential.' })
    const allowed = method === 'POST' && path === '/api/assets'
      || method === 'GET' && /^\/api\/assets\/[^/%]+(?:\/content)?$/.test(path)
      || method === 'PUT' && /^\/api\/assets\/[^/%]+\/references\/tags$/.test(path)
    if (!allowed) throw createError({ statusCode: 403, statusMessage: 'Operation not allowed for integration.' })
    event.context.accessIdentity = 'application'
    return
  }
  const owner = await hasOwnerSession(ownerCookie(event))
  // The shell never contains library data; app.vue chooses login or LibraryApp.
  if (path === '/' && ['GET', 'HEAD'].includes(method)) { if (owner) event.context.accessIdentity = 'owner'; return }
  if (!owner) {
    if (path === '/share' && method === 'POST') return sendRedirect(event, '/?login=share', 303)
    throw createError({ statusCode: 401, statusMessage: 'Sign in required.' })
  }
  event.context.accessIdentity = 'owner'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) requireSameOrigin(event, config, path === '/share' && method === 'POST')
})
