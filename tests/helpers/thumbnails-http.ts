import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createApp, createRouter, defineEventHandler, getRouterParam, toNodeListener } from 'h3'
import { createRequire } from 'node:module'
import type { ImageRow } from '../../server/db.ts'
const sharp = createRequire(new URL('../../runtime/similarity/package.json', import.meta.url))('sharp')

Object.assign(globalThis, { defineEventHandler, getRouterParam })
const { ensureDataStore, toImageResponse, hashImageBytes } = await import('../../server/db.ts')
const { saveImage } = await import('../../server/image-storage.ts')
const db = await ensureDataStore()
const router = createRouter()
router.get('/thumbnails/:id', (await import('../../server/routes/thumbnails/[id].get.ts')).default)
router.get('/images/:filename', (await import('../../server/routes/images/[filename].get.ts')).default)
router.delete('/api/images/:id', (await import('../../server/api/images/[id].delete.ts')).default)
const app = createApp({ debug: false }); app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
const previewPath = (id: string, hash: string) => `data/thumbnails/${id}/v1-${hash}.webp`
const missing = (path: string) => stat(path).then(() => false, () => true)
try {
  if (process.argv.includes('--cached')) {
    const row = db.prepare("SELECT * FROM images WHERE original_name = 'large.png'").get() as ImageRow
    assert.equal((await fetch(base + toImageResponse(row).thumbnailSrc)).status, 200)
  } else {
    await mkdir('runtime', { recursive: true })
    await symlink(new URL('../../runtime/similarity', import.meta.url).pathname, 'runtime/similarity', 'dir')
    const save = async (bytes: Buffer, name = 'test') => (await saveImage({ data: bytes, originalName: name, mimeType: 'image/png', sourceUrl: null })).row
    let seed = 42
    const pixels = Buffer.alloc(1600 * 1200 * 3)
    for (let i = 0; i < pixels.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[i] = seed >>> 24 }
    const original = await sharp(pixels, { raw: { width: 1600, height: 1200, channels: 3 } }).png().toBuffer()
    const row = await save(original, 'large.png'), response = toImageResponse(row)
    const url = base + response.thumbnailSrc, path = previewPath(row.id, row.content_hash!)
    assert.ok(await missing(path), 'saving must not generate a preview')
    const started = performance.now()
    const [a, b] = await Promise.all([fetch(url), fetch(url)])
    assert.equal(a.status, 200); assert.equal(b.status, 200)
    assert.equal(a.headers.get('content-type'), 'image/webp')
    assert.equal(a.headers.get('cache-control'), 'private, max-age=31536000, immutable')
    const bytes = Buffer.from(await a.arrayBuffer())
    assert.deepEqual(Buffer.from(await b.arrayBuffer()), bytes)
    const firstPairMs = Math.round(performance.now() - started)
    const meta = await sharp(bytes).metadata()
    assert.equal(meta.width, 640); assert.equal(meta.height, 480)
    assert.ok(bytes.length < original.length * 0.3, 'large fixture should save at least 70%')
    const generated = await stat(path)
    assert.deepEqual(await readdir(`data/thumbnails/${row.id}`), [`v1-${row.content_hash}.webp`])
    const conditional = await fetch(url, { headers: { 'If-None-Match': a.headers.get('etag')! } })
    assert.equal(conditional.status, 304); assert.equal((await conditional.arrayBuffer()).byteLength, 0)
    const restart = spawnSync(process.execPath, [new URL('./thumbnails-http.ts', import.meta.url).pathname, '--cached'], { encoding: 'utf8', timeout: 10000 })
    assert.equal(restart.status, 0, restart.stdout + restart.stderr)
    assert.equal((await stat(path)).mtimeMs, generated.mtimeMs, 'restart must reuse file')
    assert.equal(hashImageBytes(await readFile(`data/images/${row.filename}`)), row.content_hash)
    assert.deepEqual(Buffer.from(await (await fetch(base + response.src)).arrayBuffer()), original)
    assert.equal((await fetch(url.replace('v=v1', 'v=v0'))).status, 404)
    assert.equal((await fetch(url.replace(row.content_hash!, '0'.repeat(64)))).status, 404)
    console.log(`Preview fixture: ${original.length} -> ${bytes.length} bytes; first pair ${firstPairMs} ms.`)

    const alpha = await save(await sharp({ create: { width: 100, height: 60, channels: 4, background: '#ff000080' } }).png().toBuffer())
    const alphaBytes = Buffer.from(await (await fetch(base + toImageResponse(alpha).thumbnailSrc)).arrayBuffer())
    const alphaMeta = await sharp(alphaBytes).metadata()
    assert.equal(alphaMeta.width, 100); assert.equal(alphaMeta.height, 60); assert.equal(alphaMeta.hasAlpha, true)
    const alphaPixels = await sharp(alphaBytes).raw().toBuffer()
    assert.ok(Math.abs(alphaPixels[3] - 128) <= 1)

    const oriented = await save(await sharp({ create: { width: 80, height: 40, channels: 3, background: 'red' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer())
    const orientedMeta = await sharp(Buffer.from(await (await fetch(base + toImageResponse(oriented).thumbnailSrc)).arrayBuffer())).metadata()
    assert.equal(orientedMeta.width, 40); assert.equal(orientedMeta.height, 80)
    for (const name of ['tiny.jpg', 'tiny.png', 'tiny.webp', 'tiny.avif', 'animated.gif', 'animated.webp']) {
      const fixture = await readFile(new URL(`../fixtures/images/${name}`, import.meta.url))
      const image = await save(fixture, name)
      const result = await fetch(base + toImageResponse(image).thumbnailSrc)
      assert.equal(result.status, 200, name)
      const metadata = await sharp(Buffer.from(await result.arrayBuffer())).metadata()
      assert.equal(metadata.format, 'webp', name)
      assert.ok(!metadata.pages || metadata.pages === 1, name)
      assert.deepEqual(await readFile(`data/images/${image.filename}`), fixture)
    }

    const broken = await save(await sharp({ create: { width: 10, height: 12, channels: 3, background: 'blue' } }).png().toBuffer())
    await writeFile(`data/images/${broken.filename}`, 'broken')
    const fallback = await fetch(base + toImageResponse(broken).thumbnailSrc, { redirect: 'manual' })
    assert.equal(fallback.status, 302)
    assert.equal(fallback.headers.get('cache-control'), 'no-store')
    assert.equal(fallback.headers.get('location'), toImageResponse(broken).src)
    assert.ok(await missing(previewPath(broken.id, broken.content_hash!)))
    assert.equal((await fetch(base + toImageResponse(broken).thumbnailSrc, { redirect: 'manual' })).status, 302)
    // Matching hash with undecodable bytes exercises the decoder failure as well.
    broken.content_hash = hashImageBytes(Buffer.from('broken'))
    db.prepare('UPDATE images SET content_hash = ? WHERE id = ?').run(broken.content_hash, broken.id)
    const decodeFailure = await fetch(base + toImageResponse(broken).thumbnailSrc, { redirect: 'manual' })
    assert.equal(decodeFailure.status, 302)
    assert.equal(decodeFailure.headers.get('cache-control'), 'no-store')
    assert.ok(await missing(previewPath(broken.id, broken.content_hash)))

    assert.equal((await fetch(`${base}/api/images/${row.id}`, { method: 'DELETE' })).status, 200)
    assert.ok(await missing(`data/thumbnails/${row.id}`))
    assert.equal((await fetch(url)).status, 404)
    assert.ok(await missing(`data/images/${row.filename}`))

    // Deletion while another request is queued/decoding cannot leave an orphan.
    const race = await save(original, 'race.png')
    const inFlight = fetch(base + toImageResponse(race).thumbnailSrc)
    await fetch(`${base}/api/images/${race.id}`, { method: 'DELETE' })
    const raced = await inFlight
    await raced.arrayBuffer()
    assert.ok([200, 404].includes(raced.status))
    assert.ok(await missing(`data/thumbnails/${race.id}`))
  }
} finally { await new Promise<void>(resolve => server.close(() => resolve())) }
