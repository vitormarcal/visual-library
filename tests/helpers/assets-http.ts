import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { createApp, createRouter, defineEventHandler, getRouterParam, toNodeListener } from 'h3'

// Build a pre-feature database to verify migration against real old rows.
await mkdir('data')
const old = new DatabaseSync('data/library.sqlite')
old.exec(`CREATE TABLE images (id TEXT PRIMARY KEY, filename TEXT NOT NULL, original_name TEXT, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL);
 INSERT INTO images VALUES ('legacy', 'legacy.png', 'old.png', 'application/octet-stream', 297, '2020-01-01T00:00:00Z')`)
old.close()
let limit = 1024
Object.assign(globalThis, { defineEventHandler, getRouterParam, useRuntimeConfig: () => ({ public: { maxImageSizeBytes: limit } }) })
const { ensureDataStore, replaceImageTags, listTagSummaries, findTag, setImageVisibility, getImageTags } = await import('../../server/db.ts')
const db = await ensureDataStore()
const legacy = db.prepare('SELECT * FROM images WHERE id = ?').get('legacy')!
assert.equal(legacy.source, 'visual-library'); assert.equal(legacy.hidden_from_gallery, 0)
const fixture = async (extension: string) => readFile(new URL(`../fixtures/images/tiny.${extension}`, import.meta.url))
const png = await fixture('png')
await writeFile('data/images/legacy.png', png)
const router = createRouter()
for (const [method, path, file] of [
  ['post', '/api/assets', '../../server/api/assets.post.ts'],
  ['get', '/api/assets/:id', '../../server/api/assets/[id].get.ts'],
  ['get', '/api/assets/:id/content', '../../server/api/assets/[id]/content.get.ts'],
  ['post', '/api/images', '../../server/api/images.post.ts'],
  ['patch', '/api/images/:id/visibility', '../../server/api/images/[id]/visibility.patch.ts'],
  ['get', '/images/:filename', '../../server/routes/images/[filename].get.ts'],
]) {
  const handler = (await import(new URL(file, import.meta.url).href)).default
  router[method as 'get'](path, handler)
}
const app = createApp({ debug: false }); app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const address = server.address() as { port: number }
const base = `http://127.0.0.1:${address.port}`
const send = async (bytes: Buffer, fields: Record<string, string> = {}, path = '/api/assets', name = 'image.jpg', mime = 'text/plain') => {
  const form = new FormData()
  form.append('image', new Blob([bytes], { type: mime }), name)
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return fetch(base + path, { method: 'POST', body: form })
}
const patch = (id: string, body: unknown) => fetch(`${base}/api/images/${id}/visibility`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
try {
  const response = await send(png, { source: 'media-pulse', hiddenFromGallery: 'true' })
  assert.equal(response.status, 201)
  const asset = await response.json()
  assert.deepEqual(Object.keys(asset).sort(), ['id', 'mimeType', 'sizeBytes', 'createdAt', 'source', 'hiddenFromGallery', 'tags', 'sourceReferences'].sort())
  assert.equal(asset.mimeType, 'image/png'); assert.equal(asset.sizeBytes, png.length)
  assert.equal(asset.source, 'media-pulse'); assert.equal(asset.hiddenFromGallery, true)
  assert.equal(response.headers.get('location'), `/api/assets/${asset.id}`)
  const duplicate = await send(png, { source: 'other', hiddenFromGallery: 'false' })
  assert.equal(duplicate.status, 200); assert.deepEqual(await duplicate.json(), asset)
  const legacyDuplicate = await send(png, {}, '/api/images')
  assert.deepEqual(await legacyDuplicate.json(), { duplicate: true, message: 'Already saved.' })
  assert.deepEqual(await (await fetch(`${base}/api/assets/${asset.id}`)).json(), asset)
  assert.equal((await fetch(`${base}/api/assets/missing`)).status, 404)
  assert.equal((await fetch(`${base}/api/assets/missing/content`)).status, 404)
  const content = await fetch(`${base}/api/assets/${asset.id}/content`)
  assert.equal(content.headers.get('content-type'), 'image/png')
  assert.equal(content.headers.get('cache-control'), 'private, max-age=3600')
  assert.deepEqual(Buffer.from(await content.arrayBuffer()), png)
  assert.equal((await fetch(`${base}/api/assets/${asset.id}/content`, { headers: { 'if-none-match': content.headers.get('etag')! } })).status, 304)
  assert.equal((await fetch(`${base}/api/assets/${asset.id}/content`, { headers: { 'if-modified-since': content.headers.get('last-modified')! } })).status, 304)
  assert.equal((await fetch(`${base}/api/assets/${asset.id}/content`, { headers: { 'if-none-match': '"different"', 'if-modified-since': 'Wed, 01 Jan 2099 00:00:00 GMT' } })).status, 200)
  const oldContent = await fetch(`${base}/images/legacy.png`)
  assert.equal(oldContent.headers.get('content-type'), 'image/png'); await oldContent.arrayBuffer()
  assert.equal(db.prepare('SELECT mime_type FROM images WHERE id = ?').get('legacy')!.mime_type, 'image/png')
  for (const bad of [Buffer.from('<svg></svg>'), Buffer.from('not image')]) assert.equal((await send(bad, {}, '/api/assets', 'fake.png', 'image/png')).status, 415)
  assert.equal((await send(Buffer.alloc(0))).status, 400)
  for (const fields of [{ source: '' }, { source: '../path' }, { source: 'A' }, { hiddenFromGallery: '1' }, { arbitrary: 'x' }]) assert.equal((await send(png, fields)).status, 400)
  const doubled = new FormData(); doubled.append('image', new Blob([png]), 'a.png'); doubled.append('image', new Blob([png]), 'b.png')
  assert.equal((await fetch(base + '/api/assets', { method: 'POST', body: doubled })).status, 400)
  assert.equal((await fetch(base + '/api/assets', { method: 'POST', body: '{"url":"x"}', headers: { 'content-type': 'application/json' } })).status, 415)
  limit = png.length
  assert.equal((await send(png)).status, 200)
  limit = png.length - 1
  assert.equal((await send(png)).status, 413)
  limit = 1024
  assert.equal((await send(Buffer.alloc(limit + 1))).status, 413)
  const chunkedResponse = await new Promise<number>((resolve, reject) => {
    const req = request(base + '/api/assets', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)) })
    req.on('error', reject); req.write(Buffer.alloc(65536)); req.end(Buffer.alloc(4096))
  })
  assert.equal(chunkedResponse, 413)
  for (const extension of ['jpg', 'gif', 'webp', 'avif']) {
    const result = await send(await fixture(extension), {}, '/api/images', 'no-extension', '')
    assert.equal(result.status, 200)
    const image = await result.json()
    assert.equal(image.source, 'visual-library'); assert.equal(image.hiddenFromGallery, false)
    const downloaded = await fetch(base + image.src)
    assert.equal(downloaded.status, 200); assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), await fixture(extension))
  }
  // Concurrent uploads preserve the first record and remove the losing file.
  const raceBytes = Buffer.from(png); raceBytes[raceBytes.length - 1] ^= 1 // structure remains valid; CRC is not decoded
  const race = await Promise.all([send(raceBytes, {source:'first'}), send(raceBytes, {source:'second'})])
  assert.deepEqual(race.map(r => r.status).sort(), [200,201])
  const raced = await Promise.all(race.map(r => r.json())); assert.deepEqual(raced[0], raced[1])
  assert.equal((await readdir('data/images')).length, Number(db.prepare('SELECT COUNT(*) AS n FROM images').get()!.n))
  const beforeFiles = await readdir('data/images')
  const beforeCount = db.prepare('SELECT COUNT(*) AS n FROM images').get()!.n
  db.exec("CREATE TRIGGER fail_asset BEFORE INSERT ON images BEGIN SELECT RAISE(ABORT, 'test insert failure'); END")
  const failedBytes = Buffer.from(raceBytes); failedBytes[failedBytes.length - 2] ^= 1
  assert.equal((await send(failedBytes)).status, 500)
  assert.deepEqual(await readdir('data/images'), beforeFiles)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM images').get()!.n, beforeCount)
  db.exec('DROP TRIGGER fail_asset')
  // Inject a partial filesystem write through the native binding, without a production adapter.
  const fs = (await import('node:fs')).default
  const { syncBuiltinESMExports } = await import('node:module')
  const originalOpen = fs.promises.open
  fs.promises.open = (async (...args: Parameters<typeof originalOpen>) => {
    const file = await originalOpen(...args)
    if (args[1] === 'wx') {
      file.writeFile = async () => { await file.write(Buffer.from('partial')); throw new Error('test partial write') }
    }
    return file
  }) as typeof originalOpen
  syncBuiltinESMExports()
  try {
    assert.equal((await send(failedBytes)).status, 500)
    assert.deepEqual(await readdir('data/images'), beforeFiles)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM images').get()!.n, beforeCount)
  } finally { fs.promises.open = originalOpen; syncBuiltinESMExports() }
  const originalUnlink = fs.promises.unlink
  db.exec("CREATE TRIGGER fail_asset BEFORE INSERT ON images BEGIN SELECT RAISE(ABORT, 'test insert failure'); END")
  fs.promises.unlink = async () => { throw new Error('test cleanup failure') }
  syncBuiltinESMExports()
  try {
    const failure = await send(failedBytes)
    assert.equal(failure.status, 500)
    const body = await failure.text()
    assert.ok(!body.includes('data/images') && !body.includes('test insert failure'))
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM images').get()!.n, beforeCount)
  } finally {
    fs.promises.unlink = originalUnlink; syncBuiltinESMExports(); db.exec('DROP TRIGGER fail_asset')
    for (const filename of await readdir('data/images')) if (!beforeFiles.includes(filename)) await unlink(`data/images/${filename}`)
  }
  // A close error after a write is also compensated.
  fs.promises.open = (async (...args: Parameters<typeof originalOpen>) => {
    const file = await originalOpen(...args)
    if (args[1] === 'wx') {
      const close = file.close.bind(file)
      file.close = async () => { await close(); throw new Error('test close failure') }
    }
    return file
  }) as typeof originalOpen
  syncBuiltinESMExports()
  try {
    assert.equal((await send(failedBytes)).status, 500)
    assert.deepEqual(await readdir('data/images'), beforeFiles)
  } finally { fs.promises.open = originalOpen; syncBuiltinESMExports() }
  // Filesystem failure doesn't produce a record.
  await mkdir('data/images-backup')
  const { rename } = await import('node:fs/promises')
  await rename('data/images', 'data/held-images'); await writeFile('data/images', 'blocked')
  assert.equal((await send(failedBytes)).status, 500)
  await unlink('data/images'); await rename('data/held-images', 'data/images')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM images').get()!.n, beforeCount)
  replaceImageTags('legacy', ['Topic']); replaceImageTags(asset.id, ['Topic'])
  const topic = listTagSummaries()[0]
  assert.equal(topic.imageCount, 1); assert.equal(topic.coverImageId, 'legacy')
  assert.equal((await patch(asset.id, { hiddenFromGallery: false })).status, 200)
  assert.equal(listTagSummaries()[0].imageCount, 2)
  assert.equal((await patch('legacy', { hiddenFromGallery: true })).status, 200)
  assert.equal(listTagSummaries()[0].coverImageId, asset.id)
  setImageVisibility(asset.id, true)
  assert.equal(listTagSummaries().length, 0); assert.equal(findTag(topic.id)!.imageCount, 0)
  assert.equal(getImageTags(asset.id).length, 1)
  setImageVisibility('legacy', false)
  assert.equal(listTagSummaries()[0].coverImageId, 'legacy')
  const tagsBefore = JSON.stringify(getImageTags(asset.id))
  db.exec("CREATE TRIGGER fail_visibility BEFORE UPDATE OF cover_image_id ON tags BEGIN SELECT RAISE(ABORT, 'rollback visibility'); END")
  assert.throws(() => setImageVisibility('legacy', true), /rollback visibility/)
  assert.equal(db.prepare('SELECT hidden_from_gallery FROM images WHERE id = ?').get('legacy')!.hidden_from_gallery, 0)
  assert.equal(listTagSummaries()[0].coverImageId, 'legacy'); assert.equal(JSON.stringify(getImageTags(asset.id)), tagsBefore)
  db.exec('DROP TRIGGER fail_visibility')
  assert.equal((await patch(asset.id, { hiddenFromGallery: 'true' })).status, 400)
  assert.equal((await patch('missing', { hiddenFromGallery: true })).status, 404)
  const storedFilename = db.prepare('SELECT filename FROM images WHERE id = ?').get(asset.id)!.filename as string
  await rename(`data/images/${storedFilename}`, 'data/images/renamed.png')
  db.prepare('UPDATE images SET filename = ? WHERE id = ?').run('renamed.png', asset.id)
  const renamedContent = await fetch(`${base}/api/assets/${asset.id}/content`)
  assert.equal(renamedContent.status, 200); assert.deepEqual(Buffer.from(await renamedContent.arrayBuffer()), png)
  const assetRow = db.prepare('SELECT filename FROM images WHERE id = ?').get(asset.id)!
  await unlink(`data/images/${assetRow.filename}`)
  assert.equal((await fetch(`${base}/api/assets/${asset.id}/content`)).status, 404)
  assert.equal((await fetch(`${base}/api/assets/${asset.id}`)).status, 200)
  // Cancel a streaming response and ensure the same server remains usable.
  const largeChunk = Buffer.alloc(2 * 1024 * 1024 + 12)
  largeChunk.writeUInt32BE(2 * 1024 * 1024, 0); largeChunk.write('tEXt', 4)
  const large = Buffer.concat([png.subarray(0, png.length - 12), largeChunk, png.subarray(png.length - 12)])
  const savedLimit = limit; limit = large.length
  const largeResponse = await send(large); assert.equal(largeResponse.status,201)
  const largeAsset = await largeResponse.json(); limit = savedLimit
  const controller = new AbortController()
  const streaming = await fetch(`${base}/api/assets/${largeAsset.id}/content`, {signal:controller.signal})
  const reader = streaming.body!.getReader(); await reader.read(); controller.abort(); await reader.cancel().catch(()=>{})
  assert.equal((await fetch(`${base}/api/assets/${largeAsset.id}`)).status,200)
  // An IO error after headers must terminate the partial response, not hang it.
  const { PassThrough } = await import('node:stream')
  fs.promises.open = (async (...args: Parameters<typeof originalOpen>) => {
    const file = await originalOpen(...args)
    if (args[1] === 'r') {
      file.createReadStream = (() => {
        const stream = new PassThrough()
        stream.once('close', () => { void file.close() })
        setTimeout(() => {
          stream.write(png.subarray(0, 16))
          setTimeout(() => stream.destroy(new Error('test midstream IO failure')), 20)
        }, 0)
        return stream
      }) as typeof file.createReadStream
    }
    return file
  }) as typeof originalOpen
  syncBuiltinESMExports()
  try {
    const partial = await fetch(`${base}/api/assets/${largeAsset.id}/content`, { signal: AbortSignal.timeout(2000) })
    assert.equal(partial.status, 200)
    await assert.rejects(partial.arrayBuffer())
  } finally { fs.promises.open = originalOpen; syncBuiltinESMExports() }
  const recoveredContent = await fetch(`${base}/api/assets/${largeAsset.id}/content`)
  assert.equal(recoveredContent.status, 200)
  assert.equal((await recoveredContent.arrayBuffer()).byteLength, large.length)
  // Controlled remote response: no network access or changes to SSRF rules.
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === 'https://8.8.8.8/fixture') return new Response(png, { headers: { 'content-type': 'text/plain' } })
    return originalFetch(url, init)
  }) as typeof fetch
  const remote = await fetch(base + '/api/images', { method:'POST', body:JSON.stringify({url:'https://8.8.8.8/fixture'}), headers:{'content-type':'application/json'} })
  assert.equal(remote.status, 200); assert.deepEqual(await remote.json(), { duplicate:true, message:'Already saved.' })
  globalThis.fetch = originalFetch
  console.log('All isolated asset HTTP and database assertions passed')
} finally {
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  db.close()
}
