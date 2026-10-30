import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, writeFile, unlink } from 'node:fs/promises'
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
db.prepare(`INSERT INTO images (id,filename,mime_type,size_bytes,created_at,source,hidden_from_gallery) VALUES ('00000000-0000-4000-8000-000000000001','private.png','image/png',?,'2026-01-01','visual-library',0)`).run(png.length)
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
  const privatePaths = ['/api/images', '/api/tags', '/api/assets/00000000-0000-4000-8000-000000000001', '/api/assets/00000000-0000-4000-8000-000000000001/content', '/images/private.png', '/thumbnails/private', '/api/search/content/status', '/api/access/tokens', '/api/images/00000000-0000-4000-8000-000000000001/public-link']
  for (const path of privatePaths) {
    const result = await call(path)
    assert.equal(result.headers.get('x-frame-options'), 'DENY')
    assert.ok(result.headers.get('content-security-policy')!.includes("frame-ancestors 'none'"))
    assert.ok(result.headers.get('content-security-policy')!.includes("object-src 'none'"))
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
  for (const [method, route] of routes) {
    if (route.startsWith('/api/auth/') || route.startsWith('/shared-images/') || route === '/share') continue
    const path = route.replace(':id', '00000000-0000-4000-8000-000000000001').replace(':filename', 'private.png')
    assert.equal((await call(path, { method: method.toUpperCase() })).status, 401, `${method} ${path}`)
  }
  assert.equal((await call('/api/search/content/prepare', { method: 'POST' })).status, 401)
  assert.equal(prepareCalled, false)
  assert.equal((await call('/api/assets', { method: 'POST', body: 'invalid huge parser should not run' })).status, 401)
  assert.equal((await call('/share', { method: 'POST', body: 'ignored' })).status, 303)
  assert.equal((await owner('/api/auth/login', 'POST', { password: 'wrong' })).status, 401)
  assert.equal((await call('/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.test', 'x-library-request': '1' }, body: JSON.stringify({ password }) })).status, 403)
  assert.equal((await call('/api/auth/login', { method: 'POST', headers: { origin }, body: JSON.stringify({ password }) })).status, 403)
  const fixedCookie = 'vl_owner_session=' + 'z'.repeat(43)
  cookie = fixedCookie
  await login()
  assert.notEqual(cookie, fixedCookie, 'Successful login must generate a fresh server-side session')
  assert.equal((await call('/api/images?session=' + cookie.split('=')[1])).status, 401)
  assert.equal((await call('/api/images', { headers: { 'x-session': cookie.split('=')[1]! } })).status, 401)
  assert.deepEqual(await (await owner('/api/auth/session')).json(), { authenticated: true, state: 'ready', generation: null })
  assert.equal((await owner('/api/images')).status, 200)
  assert.equal(db.prepare('SELECT token_hash FROM owner_sessions').all().some(row => cookie.includes(String(row.token_hash))), false)
  const privateContent = await owner('/images/private.png')
  assert.equal(privateContent.status, 200); assert.equal(privateContent.headers.get('cache-control'), 'no-store')
  const privateEtag = privateContent.headers.get('etag')!
  assert.deepEqual(Buffer.from(await privateContent.arrayBuffer()), png)
  assert.equal((await call('/images/private.png', { headers: { 'if-none-match': privateEtag } })).status, 401)
  for (const path of ['/api/access/tokens', '/api/images/00000000-0000-4000-8000-000000000001/public-link', '/api/auth/logout']) {
    assert.equal((await call(path, { method: 'POST', headers: { cookie, origin: 'https://evil.test', 'x-library-request': '1' } })).status, 403)
  }
  assert.equal((await call('/share', { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: 'ignored' })).status, 403)
  assert.equal((await call('/share', { method: 'POST', headers: { cookie }, body: 'ignored' })).status, 403)
  for (const extra of [{ 'x-library-request': '1' }, { origin }, { origin: 'null', 'x-library-request': '1' }, { origin, 'x-library-request': '1', 'sec-fetch-site': 'same-site' }]) assert.equal((await call('/api/access/tokens', { method: 'POST', headers: { cookie, ...extra }, body: '{}' })).status, 403)
  // Native share with explicit same-origin metadata reaches the existing handler.
  assert.equal((await call('/share', { method: 'POST', headers: { cookie, 'sec-fetch-site': 'same-origin' }, body: 'invalid' })).status, 303)
  assert.equal((await owner('/api/access/tokens', 'POST', { name: 'Invalid', publishPublicLinks: 'true' })).status, 400)
  const credential = await (await owner('/api/access/tokens', 'POST', { name: 'Media Pulse' })).json()
  assert.equal(credential.publishPublicLinks, false)
  const bearer = { authorization: `Bearer ${credential.token}` }
  const otherCredential = await (await owner('/api/access/tokens', 'POST', { name: 'Blog' })).json()
  assert.notEqual(otherCredential.id, credential.id)
  const row = db.prepare('SELECT token_hash FROM application_tokens WHERE id = ?').get(credential.id)!
  assert.equal(row.token_hash, store.digestSecret(credential.token)); assert.notEqual(row.token_hash, credential.token)
  assert.ok(!JSON.stringify(await (await owner('/api/access/tokens')).json()).includes(credential.token))
  assert.equal((await call('/api/assets/00000000-0000-4000-8000-000000000001', { headers: bearer })).status, 200)
  assert.equal((await call('/api/assets/00000000-0000-4000-8000-000000000001/content', { headers: bearer })).status, 200)
  for (const [path, method] of [['/api/assets/search', 'GET'], ['/api/assets/list/content', 'GET'], ['/api/assets/search/references/tags', 'PUT'], ['/api/images', 'GET'], ['/api/images/00000000-0000-4000-8000-000000000001', 'DELETE'], ['/api/images/00000000-0000-4000-8000-000000000001/public-link', 'POST'], ['/api/access/tokens', 'GET'], ['/api/search/content/prepare', 'POST'], ['/api/assets/00000000-0000-4000-8000-000000000001/content/extra', 'GET'], ['/api/assets/00000000-0000-4000-8000-000000000001/content', 'HEAD'], ['/images/private.png', 'GET']]) {
    assert.equal((await call(path!, { method, headers: bearer })).status, 403, `${method} ${path}`)
  }
  assert.equal((await call('/api/assets/00000000-0000-4000-8000-000000000001?token=' + credential.token)).status, 401)
  assert.equal((await call('/api/images', { headers: { cookie, authorization: 'Bearer invalid' } })).status, 401)
  const form = new FormData(); form.append('image', new Blob([png]), 'new.png'); form.append('source', 'media-pulse')
  assert.equal((await call('/api/assets', { method: 'POST', headers: bearer, body: form })).status, 201)
  // Allowed PUT reaches reference validation, rather than failing authentication.
  assert.equal((await call('/api/assets/00000000-0000-4000-8000-000000000001/references/tags', { method: 'PUT', headers: { ...bearer, 'content-type': 'application/json' }, body: '{}' })).status, 400)
  assert.equal((await owner('/api/images/00000000-0000-4000-8000-000000000001/public-link')).status, 200)
  assert.deepEqual(await (await owner('/api/images/00000000-0000-4000-8000-000000000001/public-link')).json(), { url: null, count: 0 })
  const [a, b] = await Promise.all([owner('/api/images/00000000-0000-4000-8000-000000000001/public-link', 'POST'), owner('/api/images/00000000-0000-4000-8000-000000000001/public-link', 'POST')])
  const link = (await a.json()).url as string
  assert.equal((await b.json()).url, link)
  const publicPath = new URL(link).pathname
  const publicContent = await call(publicPath)
  const publicCacheControl = 'public, max-age=31536000, immutable'
  assert.equal(publicContent.status, 200); assert.equal(publicContent.headers.get('cache-control'), publicCacheControl)
  assert.ok(!publicContent.headers.get('etag')!.includes('00000000-0000-4000-8000-000000000001'))
  assert.deepEqual(Buffer.from(await publicContent.arrayBuffer()), png)
  const publicEtag = publicContent.headers.get('etag')!
  for (const method of ['GET', 'HEAD']) {
    const result = await call(publicPath, { method })
    assert.equal(result.status, 200)
    assert.equal(result.headers.get('cache-control'), publicCacheControl)
    assert.equal(result.headers.get('etag'), publicEtag)
    if (method === 'HEAD') assert.equal(await result.text(), '')
    else assert.deepEqual(Buffer.from(await result.arrayBuffer()), png)
    for (const conditional of [{ 'if-none-match': publicEtag }, { 'if-modified-since': publicContent.headers.get('last-modified')! }]) {
      const unchanged = await call(publicPath, { method, headers: conditional })
      assert.equal(unchanged.status, 304)
      assert.equal(unchanged.headers.get('cache-control'), publicCacheControl)
      assert.equal(unchanged.headers.get('etag'), publicEtag)
      assert.equal(await unchanged.text(), '')
    }
  }
  for (const path of ['/images/private.png', '/api/assets/00000000-0000-4000-8000-000000000001/content']) {
    const privateResponse = await owner(path)
    assert.equal(privateResponse.headers.get('cache-control'), 'no-store')
    const unchanged = await call(path, { headers: { cookie, 'if-none-match': privateResponse.headers.get('etag')! } })
    assert.equal(unchanged.status, 304)
    assert.equal(unchanged.headers.get('cache-control'), 'no-store')
  }
  // Valid public links must not make missing or unreadable image responses cacheable.
  try {
    await unlink('data/images/private.png')
    for (const method of ['GET', 'HEAD']) {
      const missing = await call(publicPath, { method, headers: { 'if-none-match': publicEtag } })
      assert.equal(missing.status, 404)
      assert.equal(missing.headers.get('cache-control'), 'no-store')
    }
    await writeFile('data/images/private.png', 'invalid image bytes')
    for (const method of ['GET', 'HEAD']) {
      const invalid = await call(publicPath, { method })
      assert.equal(invalid.status, 500)
      assert.equal(invalid.headers.get('cache-control'), 'no-store')
      assert.equal(invalid.headers.get('etag'), null)
    }
  } finally { await writeFile('data/images/private.png', png) }

  setImageVisibility('00000000-0000-4000-8000-000000000001', true)
  assert.equal((await call(publicPath)).status, 200)
  await owner(`/api/access/tokens/${credential.id}`, 'DELETE')
  assert.equal((await call('/api/assets/00000000-0000-4000-8000-000000000001', { headers: bearer })).status, 401)
  assert.equal((await call(publicPath)).status, 200)
  assert.equal((await call('/api/assets/00000000-0000-4000-8000-000000000001', { headers: { authorization: 'Bearer ' + otherCredential.token } })).status, 200)
  const replacement = await (await owner('/api/access/tokens', 'POST', { name: 'Media Pulse', publishPublicLinks: true })).json()
  assert.notEqual(replacement.token, credential.token)
  assert.equal((await call('/api/assets/00000000-0000-4000-8000-000000000001', { headers: bearer })).status, 401)
  const publicationPath = '/api/images/00000000-0000-4000-8000-000000000001/public-link'
  const publisher = { authorization: `Bearer ${replacement.token}` }
  assert.equal(replacement.publishPublicLinks, true)
  assert.ok((await (await owner('/api/access/tokens')).json()).some(entry => entry.id === replacement.id && entry.publishPublicLinks === true))
  for (const method of ['GET', 'POST']) {
    assert.equal((await call(publicationPath, { method, headers: bearer })).status, 401)
    assert.equal((await call(publicationPath, { method, headers: { authorization: `Bearer ${otherCredential.token}` } })).status, 403)
    const response = await call(publicationPath, { method, headers: publisher })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { url: link, count: 1 })
  }
  for (const [path, method] of [[publicationPath, 'DELETE'], [publicationPath, 'PUT'], [publicationPath, 'HEAD'], ['/api/images', 'GET'], ['/api/access/tokens', 'POST'], ['/api/assets', 'DELETE'], ['/api/images/00000000-0000-4000-8000-000000000001', 'DELETE'], [publicationPath + '/extra', 'POST'], ['/api/images/search/public-link', 'POST']]) {
    assert.equal((await call(path!, { method, headers: publisher })).status, 403, `${method} ${path}`)
  }
  assert.equal((await call('/api/images/00000000-0000-4000-8000-000000000099/public-link', { method: 'POST', headers: publisher })).status, 404)
  await owner(publicationPath, 'DELETE')
  const published = await call(publicationPath, { method: 'POST', headers: publisher })
  assert.equal(published.status, 200)
  const publishedPath = new URL((await published.json()).url).pathname
  assert.deepEqual(Buffer.from(await (await call(publishedPath)).arrayBuffer()), png)
  await owner(`/api/access/tokens/${replacement.id}`, 'DELETE')
  for (const method of ['GET', 'POST']) assert.equal((await call(publicationPath, { method, headers: publisher })).status, 401)
  assert.equal((await call(publishedPath)).status, 200)
  await owner('/api/images/00000000-0000-4000-8000-000000000001/public-link', 'DELETE')
  for (const method of ['GET', 'HEAD']) {
    const revoked = await call(publicPath, { method, headers: { 'if-none-match': publicEtag } })
    assert.equal(revoked.status, 404)
    assert.equal(revoked.headers.get('cache-control'), 'no-store')
  }
  const newLink = (await (await owner('/api/images/00000000-0000-4000-8000-000000000001/public-link', 'POST')).json()).url
  assert.notEqual(newLink, link)
  assert.equal((await call(publicPath)).status, 404)
  for (const path of ['/api/images/', '/api/%69mages', '/api/assets/00000000-0000-4000-8000-000000000001%2fcontent', '/api/auth/session/extra']) assert.equal((await call(path)).status, 401, path)
  assert.equal((await call('/shared-images/short')).status, 404)
  // New reset commands revoke owner credentials/sessions, while preserving apps and links.
  const beforeReset = await store.ownerPasswordHash()
  const resetB = { resetKey: '22222222-2222-4222-8222-222222222222', origin }
  await store.initializeOwnerAccess(resetB)
  assert.equal(await store.ownerPasswordHash(), null)
  assert.equal((await owner('/api/images')).status, 401)
  assert.equal(db.prepare('SELECT count(*) AS n FROM owner_sessions').get()!.n, 0)
  assert.equal((await call(new URL(newLink).pathname)).status, 200)
  assert.equal((await call('/api/assets/00000000-0000-4000-8000-000000000001', { headers: { authorization: 'Bearer ' + otherCredential.token } })).status, 200)
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
  const other = db.prepare("SELECT id FROM images WHERE id != '00000000-0000-4000-8000-000000000001' LIMIT 1").get()!
  await store.publicImageLink(String(other.id), true)
  deleteImageRecord('00000000-0000-4000-8000-000000000001')
  assert.equal((await call(new URL(newLink).pathname)).status, 404)
  assert.equal(db.prepare("SELECT 1 FROM image_public_links WHERE image_id='00000000-0000-4000-8000-000000000001'").get(), undefined)
  const savedOrigin = origin
  origin = 'https://library.example'
  const secureLogin = await call('/api/auth/login', { method: 'POST', headers: { origin, 'x-library-request': '1', 'content-type': 'application/json' }, body: JSON.stringify({ password }) })
  assert.equal(secureLogin.status, 200)
  assert.match(secureLogin.headers.get('set-cookie')!, /^__Host-vl_owner_session=/)
  assert.match(secureLogin.headers.get('set-cookie')!, /; Secure/i)
  assert.ok(!secureLogin.headers.get('set-cookie')!.includes('Domain='))
  assert.equal(secureLogin.headers.get('strict-transport-security'), 'max-age=31536000')
  assert.equal((await owner('/api/images')).status, 401, 'HTTPS must ignore legacy unprefixed cookies')
  const secureCookie = secureLogin.headers.get('set-cookie')!.split(';')[0]!
  assert.equal((await call('/api/images', { headers: { cookie: secureCookie } })).status, 200)
  assert.equal((await call('/api/images', { headers: { cookie: '__Host-vl_owner_session=' + 'x'.repeat(43) } })).status, 401)

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
