import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'

const password = 'correct password for tests'
let resetKey = ''
let origin = 'http://127.0.0.1'
Object.assign(globalThis, { defineNitroPlugin: (plugin: unknown) => plugin, defineEventHandler, useRuntimeConfig: () => ({ ownerResetKey: resetKey, libraryOrigin: origin, public: { maxImageSizeBytes: 15728640 } }) })
const store = await import('../../server/access-store.ts')
assert.throws(() => store.validateAccessConfig({ resetKey: 'invalid', origin }))
assert.throws(() => store.validateAccessConfig({ resetKey: '', origin: 'http://remote.example' }))
assert.throws(() => store.validateAccessConfig({ resetKey: '', origin: 'https://example.com/path' }))
const accessPlugin = (await import('../../server/plugins/access.ts')).default
const configuredOrigin = origin
origin = ''
assert.throws(() => accessPlugin({ hooks: { hook() {} } }), /NUXT_LIBRARY_ORIGIN/)
origin = configuredOrigin
let startup: (() => Promise<void>) | undefined
accessPlugin({ hooks: { hook(_name: string, ready: () => Promise<void>) { startup = ready } } })
await startup!()
const { ensureDataStore, deleteImageRecord, setImageVisibility } = await import('../../server/db.ts')
const db = await ensureDataStore()
const png = await readFile(new URL('../fixtures/images/tiny.png', import.meta.url))
await writeFile('data/images/private.png', png)
db.prepare(`INSERT INTO images (id,filename,mime_type,size_bytes,created_at,source,hidden_from_gallery) VALUES ('private','private.png','image/png',?,'2026-01-01','visual-library',0)`).run(png.length)
const router = createRouter()
const routes = [
  ['post', '/api/auth/setup', 'api/auth/setup.post.ts'], ['post', '/api/auth/login', 'api/auth/login.post.ts'], ['get', '/api/auth/session', 'api/auth/session.get.ts'], ['post', '/api/auth/logout', 'api/auth/logout.post.ts'],
  ['get', '/api/access/tokens', 'api/access/tokens.get.ts'], ['post', '/api/access/tokens', 'api/access/tokens.post.ts'], ['delete', '/api/access/tokens/:id', 'api/access/tokens/[id].delete.ts'],
  ['get', '/api/images/:id/public-link', 'api/images/[id]/public-link.get.ts'], ['post', '/api/images/:id/public-link', 'api/images/[id]/public-link.post.ts'], ['delete', '/api/images/:id/public-link', 'api/images/[id]/public-link.delete.ts'],
  ['get', '/api/images', 'api/images.get.ts'], ['post', '/api/assets', 'api/assets.post.ts'], ['get', '/api/assets/:id', 'api/assets/[id].get.ts'], ['get', '/api/assets/:id/content', 'api/assets/[id]/content.get.ts'],
  ['put', '/api/assets/:id/references/tags', 'api/assets/[id]/references/tags.put.ts'],
  ['get', '/images/:filename', 'routes/images/[filename].get.ts'], ['get', '/thumbnails/:id', 'routes/thumbnails/[id].get.ts'], ['post', '/share', 'routes/share.post.ts'],
  ['get', '/shared-images/:token', 'routes/shared-images/[token].get.ts'],
] as const
for (const [method, path, file] of routes) router[method](path, (await import(new URL('../../server/' + file, import.meta.url).href)).default)
router.head('/shared-images/:token', (await import('../../server/routes/shared-images/[token].get.ts')).default)
let prepareCalled = false
router.post('/api/search/content/prepare', defineEventHandler(() => { prepareCalled = true; return {} }))
const app = createApp({ debug: false })
app.use((await import('../../server/middleware/access.ts')).default)
app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
const base = origin
const call = (path: string, init: RequestInit = {}) => fetch(base + path, { redirect: 'manual', ...init })
const intent = { origin: '', 'x-library-request': '1' }
intent.origin = origin
let cookie = ''
const owner = (path: string, method = 'GET', body?: unknown) => call(path, { method, headers: { ...intent, cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const login = async () => {
  const result = await owner('/api/auth/login', 'POST', { password })
  assert.equal(result.status, 200)
  const header = result.headers.get('set-cookie')!
  assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=Lax/i); assert.match(header, /Path=\//i)
  cookie = header.split(';')[0]!
}
try {
  const privatePaths = ['/api/images', '/api/tags', '/api/assets/private', '/api/assets/private/content', '/images/private.png', '/thumbnails/private', '/api/search/content/status', '/api/access/tokens', '/api/images/private/public-link']
  for (const path of privatePaths) {
    const result = await call(path)
    assert.equal(result.status, 401, path); assert.equal(result.headers.get('cache-control'), 'no-store')
    assert.ok(!(await result.text()).includes('private.png'))
  }
  assert.deepEqual(await (await call('/api/auth/session')).json(), { authenticated: false, state: 'blocked', generation: null })
  assert.equal((await owner('/api/auth/setup', 'POST', { password, confirmation: password, generation: 'not-armed' })).status, 409)
  resetKey = '11111111-1111-4111-8111-111111111111'
  const resetConfig = { resetKey, origin }
  await store.initializeOwnerAccess(resetConfig)
  const pending = await (await call('/api/auth/session')).json()
  assert.equal(pending.state, 'setup')
  assert.ok(!JSON.stringify(pending).includes(resetKey))
  const competing = await Promise.all([1, 2].map(() => owner('/api/auth/setup', 'POST', { password, confirmation: password, generation: pending.generation })))
  assert.deepEqual(competing.map(r => r.status).sort(), [200, 409])
  const savedHash = await store.ownerPasswordHash()
  assert.ok(savedHash && savedHash !== password)
  await store.initializeOwnerAccess(resetConfig)
  assert.equal(await store.ownerPasswordHash(), savedHash)
  await store.initializeOwnerAccess({ resetKey: '', origin })
  assert.equal(await store.ownerPasswordHash(), savedHash)
  assert.equal(db.prepare('SELECT key_hash FROM owner_reset_commands').get()!.key_hash, store.digestSecret(resetKey))
  assert.equal((await call('/api/auth/setup', { method: 'POST', headers: { origin: 'https://evil.test', 'x-library-request': '1' }, body: '{}' })).status, 403)
  assert.equal((await call('/api/search/content/prepare', { method: 'POST' })).status, 401)
  assert.equal(prepareCalled, false)
  assert.equal((await call('/api/assets', { method: 'POST', body: 'invalid huge parser should not run' })).status, 401)
  assert.equal((await call('/share', { method: 'POST', body: 'ignored' })).status, 303)
  assert.equal((await owner('/api/auth/login', 'POST', { password: 'wrong' })).status, 401)
  assert.equal((await call('/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.test', 'x-library-request': '1' }, body: JSON.stringify({ password }) })).status, 403)
  assert.equal((await call('/api/auth/login', { method: 'POST', headers: { origin }, body: JSON.stringify({ password }) })).status, 403)
  await login()
  assert.deepEqual(await (await owner('/api/auth/session')).json(), { authenticated: true, state: 'ready', generation: null })
  assert.equal((await owner('/api/images')).status, 200)
  assert.equal(db.prepare('SELECT token_hash FROM owner_sessions').all().some(row => cookie.includes(String(row.token_hash))), false)
  const privateContent = await owner('/images/private.png')
  assert.equal(privateContent.status, 200); assert.equal(privateContent.headers.get('cache-control'), 'no-store')
  const privateEtag = privateContent.headers.get('etag')!
  assert.deepEqual(Buffer.from(await privateContent.arrayBuffer()), png)
  assert.equal((await call('/images/private.png', { headers: { 'if-none-match': privateEtag } })).status, 401)
  for (const path of ['/api/access/tokens', '/api/images/private/public-link', '/api/auth/logout']) {
    assert.equal((await call(path, { method: 'POST', headers: { cookie, origin: 'https://evil.test', 'x-library-request': '1' } })).status, 403)
  }
  assert.equal((await call('/share', { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: 'ignored' })).status, 403)
  assert.equal((await call('/share', { method: 'POST', headers: { cookie }, body: 'ignored' })).status, 403)
  // Native share with explicit same-origin metadata reaches the existing handler.
  assert.equal((await call('/share', { method: 'POST', headers: { cookie, 'sec-fetch-site': 'same-origin' }, body: 'invalid' })).status, 303)
  const credential = await (await owner('/api/access/tokens', 'POST', { name: 'Media Pulse' })).json()
  const bearer = { authorization: `Bearer ${credential.token}` }
  const otherCredential = await (await owner('/api/access/tokens', 'POST', { name: 'Blog' })).json()
  assert.notEqual(otherCredential.id, credential.id)
  const row = db.prepare('SELECT token_hash FROM application_tokens').get()!
  assert.equal(row.token_hash, store.digestSecret(credential.token)); assert.notEqual(row.token_hash, credential.token)
  assert.ok(!JSON.stringify(await (await owner('/api/access/tokens')).json()).includes(credential.token))
  assert.equal((await call('/api/assets/private', { headers: bearer })).status, 200)
  assert.equal((await call('/api/assets/private/content', { headers: bearer })).status, 200)
  for (const [path, method] of [['/api/images', 'GET'], ['/api/images/private', 'DELETE'], ['/api/images/private/public-link', 'POST'], ['/api/access/tokens', 'GET'], ['/api/search/content/prepare', 'POST'], ['/api/assets/private/content/extra', 'GET'], ['/api/assets/private/content', 'HEAD'], ['/images/private.png', 'GET']]) {
    assert.equal((await call(path!, { method, headers: bearer })).status, 403, `${method} ${path}`)
  }
  assert.equal((await call('/api/assets/private?token=' + credential.token)).status, 401)
  assert.equal((await call('/api/images', { headers: { cookie, authorization: 'Bearer invalid' } })).status, 401)
  const form = new FormData(); form.append('image', new Blob([png]), 'new.png'); form.append('source', 'media-pulse')
  assert.equal((await call('/api/assets', { method: 'POST', headers: bearer, body: form })).status, 201)
  // Allowed PUT reaches reference validation, rather than failing authentication.
  assert.equal((await call('/api/assets/private/references/tags', { method: 'PUT', headers: { ...bearer, 'content-type': 'application/json' }, body: '{}' })).status, 400)
  assert.equal((await owner('/api/images/private/public-link')).status, 200)
  assert.deepEqual(await (await owner('/api/images/private/public-link')).json(), { url: null })
  const [a, b] = await Promise.all([owner('/api/images/private/public-link', 'POST'), owner('/api/images/private/public-link', 'POST')])
  const link = (await a.json()).url as string
  assert.equal((await b.json()).url, link)
  const publicPath = new URL(link).pathname
  const publicContent = await call(publicPath)
  assert.equal(publicContent.status, 200); assert.equal(publicContent.headers.get('cache-control'), 'no-store')
  assert.ok(!publicContent.headers.get('etag')!.includes('private'))
  assert.deepEqual(Buffer.from(await publicContent.arrayBuffer()), png)
  const publicEtag = publicContent.headers.get('etag')!
  assert.equal((await call(publicPath, { method: 'HEAD' })).status, 200)
  assert.equal((await call(publicPath, { headers: { 'if-none-match': publicEtag } })).status, 304)
  setImageVisibility('private', true)
  assert.equal((await call(publicPath)).status, 200)
  await owner(`/api/access/tokens/${credential.id}`, 'DELETE')
  assert.equal((await call('/api/assets/private', { headers: bearer })).status, 401)
  assert.equal((await call(publicPath)).status, 200)
  assert.equal((await call('/api/assets/private', { headers: { authorization: 'Bearer ' + otherCredential.token } })).status, 200)
  const replacement = await (await owner('/api/access/tokens', 'POST', { name: 'Media Pulse' })).json()
  assert.notEqual(replacement.token, credential.token)
  assert.equal((await call('/api/assets/private', { headers: bearer })).status, 401)
  await owner('/api/images/private/public-link', 'DELETE')
  assert.equal((await call(publicPath, { headers: { 'if-none-match': publicEtag } })).status, 404)
  assert.equal((await call(publicPath, { method: 'HEAD' })).status, 404)
  const newLink = (await (await owner('/api/images/private/public-link', 'POST')).json()).url
  assert.notEqual(newLink, link)
  assert.equal((await call(publicPath)).status, 404)
  for (const path of ['/api/images/', '/api/%69mages', '/api/assets/private%2fcontent', '/api/auth/session/extra']) assert.equal((await call(path)).status, 401, path)
  assert.equal((await call('/shared-images/short')).status, 404)
  // New reset commands revoke owner credentials/sessions, while preserving apps and links.
  const beforeReset = await store.ownerPasswordHash()
  const resetB = { resetKey: '22222222-2222-4222-8222-222222222222', origin }
  await store.initializeOwnerAccess(resetB)
  assert.equal(await store.ownerPasswordHash(), null)
  assert.equal((await owner('/api/images')).status, 401)
  assert.equal(db.prepare('SELECT count(*) AS n FROM owner_sessions').get()!.n, 0)
  assert.equal((await call(new URL(newLink).pathname)).status, 200)
  assert.equal((await call('/api/assets/private', { headers: { authorization: 'Bearer ' + otherCredential.token } })).status, 200)
  const resetState = await store.ownerAccessState()
  await assert.rejects(store.defineOwnerPassword(password, password, pending.generation), error => error.status === 409)
  await assert.rejects(store.defineOwnerPassword('short', 'short', resetState.generation), error => error.status === 400)
  await assert.rejects(store.defineOwnerPassword(password, 'mismatch', resetState.generation), error => error.status === 400)
  await store.defineOwnerPassword(password, password, resetState.generation)
  await assert.rejects(store.createOwnerSession(beforeReset!), error => error.status === 401)
  const currentHash = await store.ownerPasswordHash()
  await store.initializeOwnerAccess(resetConfig)
  await store.initializeOwnerAccess(resetB)
  assert.equal(await store.ownerPasswordHash(), currentHash, 'Reusing either old UUID must not reset the owner')
  await login()
  db.prepare('UPDATE owner_sessions SET expires_at = 0').run()
  assert.equal((await owner('/api/images')).status, 401)
  await login()
  const previousCookie = cookie
  assert.equal((await owner('/api/auth/logout', 'POST')).status, 200)
  assert.equal((await call('/api/images', { headers: { cookie: previousCookie } })).status, 401)
  await login()
  const other = db.prepare("SELECT id FROM images WHERE id != 'private' LIMIT 1").get()!
  await store.publicImageLink(String(other.id), true)
  deleteImageRecord('private')
  assert.equal((await call(new URL(newLink).pathname)).status, 404)
  assert.equal(db.prepare("SELECT 1 FROM image_public_links WHERE image_id='private'").get(), undefined)
  const savedOrigin = origin
  origin = 'https://library.example'
  const secureLogin = await call('/api/auth/login', { method: 'POST', headers: { origin, 'x-library-request': '1', 'content-type': 'application/json' }, body: JSON.stringify({ password }) })
  assert.equal(secureLogin.status, 200)
  assert.match(secureLogin.headers.get('set-cookie')!, /; Secure/i)
  origin = savedOrigin
  // Throttle before expensive password derivation.
  for (let i = 0; i < 12; i++) await owner('/api/auth/login', 'POST', { password: 'wrong' })
  const limited = await owner('/api/auth/login', 'POST', { password })
  assert.equal(limited.status, 429); assert.ok(limited.headers.get('retry-after'))
  console.log('Access HTTP boundaries and revocation passed')
} finally {
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  db.close()
}
