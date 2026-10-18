import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'

Object.assign(globalThis, { defineEventHandler, useRuntimeConfig: () => ({ public: { maxImageSizeBytes: 1024 } }) })
const { ensureDataStore } = await import('../../server/db.ts')
const db = await ensureDataStore()
const listImages = () => db.prepare('SELECT * FROM images').all()
const router = createRouter()
router.post('/share', (await import('../../server/routes/share.post.ts')).default)
const app = createApp({ debug: false }); app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
const realFetch = globalThis.fetch
const gif = await readFile(new URL('../fixtures/images/tiny.gif', import.meta.url))
// Public literal IP avoids DNS/network dependencies while exercising the real URL validator.
globalThis.fetch = async (input, init) => {
  if (input instanceof URL && input.hostname === '93.184.216.34') {
    return new Response(input.pathname === '/image.gif' ? gif : '<html>A post</html>')
  }
  return realFetch(input, init)
}
const send = async (form: FormData) => {
  const response = await fetch(base + '/share', { method: 'POST', body: form, redirect: 'manual' })
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const location = response.headers.get('location')!
  assert.ok(location.startsWith('/?view=library&'))
  return new URL(location, base).searchParams
}
try {
  const png = await readFile(new URL('../fixtures/images/tiny.png', import.meta.url))
  const form = new FormData()
  form.append('image', new Blob([png], { type: 'text/plain' }), 'shared.png')
  form.append('image', new Blob(['not an image'], { type: 'image/png' }), 'invalid.png')
  form.set('url', 'https://example.com/page')
  let result = await send(form)
  assert.equal(result.get('saved'), '1'); assert.equal(result.get('failed'), '1')
  assert.equal(listImages().length, 1)
  const row = listImages()[0]
  assert.equal(row.mime_type, 'image/png'); assert.equal(row.source, 'visual-library')
  result = await send(form)
  assert.equal(result.get('duplicates'), '1'); assert.equal(result.get('failed'), '1')
  assert.equal(listImages().length, 1)
  result = await send(new FormData())
  assert.equal(result.get('shared'), 'invalid')
  const privateUrl = new FormData(); privateUrl.set('text', base + '/private.png')
  result = await send(privateUrl)
  assert.equal(result.get('failed'), '1')
  const malformed = await fetch(base + '/share', { method: 'POST', body: '{}', redirect: 'manual' })
  assert.equal(malformed.status, 303)
  assert.match(malformed.headers.get('location')!, /shared=invalid/)
  const oversized = new FormData(); oversized.append('image', new Blob([new Uint8Array(70000)]), 'large.png')
  assert.equal((await send(oversized)).get('shared'), 'too-large')
  const excessive = new FormData()
  for (let i = 0; i < 21; i++) excessive.append('image', new Blob([png]), `image-${i}.png`)
  assert.equal((await send(excessive)).get('shared'), 'invalid')
  assert.equal(listImages().length, 1)
  const link = new FormData(); link.set('text', 'A reference\nhttps://93.184.216.34/image.gif')
  assert.equal((await send(link)).get('saved'), '1')
  assert.equal(listImages().length, 2)
  assert.equal(listImages().find(row => row.mime_type === 'image/gif')!.source_url, 'https://93.184.216.34/image.gif')
  assert.equal((await send(link)).get('duplicates'), '1')
  link.set('text', 'https://93.184.216.34/post')
  assert.equal((await send(link)).get('failed'), '1')
  assert.equal(listImages().length, 2)
} finally {
  globalThis.fetch = realFetch
  await new Promise<void>(resolve => server.close(() => resolve()))
  db.close()
}
