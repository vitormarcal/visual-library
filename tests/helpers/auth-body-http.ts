import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'

let origin = 'http://127.0.0.1'
Object.assign(globalThis, { defineEventHandler, useRuntimeConfig: () => ({ ownerResetKey: '', libraryOrigin: origin, public: { maxImageSizeBytes: 1024 } }) })
const store = await import('../../server/access-store.ts')
await store.initializeOwnerAccess({ resetKey: 'a0000000-0000-4000-8000-000000000001', origin })
const password = 'body-security-test-password'
await store.defineOwnerPassword(password, password, (await store.ownerAccessState()).generation)
const { readLimitedRequest } = await import('../../server/image-upload.ts')
const router = createRouter()
router.post('/api/auth/login', (await import('../../server/api/auth/login.post.ts')).default)
router.post('/api/body-timeout', defineEventHandler(async event => { await readLimitedRequest(event, 1024, 30); return {} }))
const app = createApp({ debug: false }); app.use((await import('../../server/middleware/access.ts')).default); app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const port = (server.address() as { port: number }).port
origin = `http://127.0.0.1:${port}`
const headers = { origin, 'x-library-request': '1', 'content-type': 'application/json' }
let received = 0, ready: () => void
const pendingRequests = new Promise<void>(resolve => { ready = resolve })
server.on('request', req => { if (req.url === '/api/auth/login' && ++received === 2) ready() })
const held = [1, 2].map(() => {
  const req = request({ host: '127.0.0.1', port, path: '/api/auth/login', method: 'POST', headers })
  req.on('error', () => {})
  req.write('{"password":')
  return req
})
try {
  await pendingRequests
  const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ password }) })
  assert.equal(login.status, 200, 'Incomplete JSON bodies must not reserve password derivation slots')
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const response = await new Promise<number>(resolve => {
    const req = request({ host: '127.0.0.1', port, path: '/api/body-timeout', method: 'POST', headers: { ...headers, cookie } }, res => {
      res.resume(); res.on('end', () => { req.destroy(); resolve(res.statusCode!) })
    })
    req.on('error', () => {})
    req.write('{')
  })
  assert.equal(response, 408)
  console.log('Incomplete auth bodies do not block login; bounded body reads return 408')
} finally {
  for (const req of held) req.destroy()
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  const { ensureDataStore } = await import('../../server/db.ts'); (await ensureDataStore()).close()
}
