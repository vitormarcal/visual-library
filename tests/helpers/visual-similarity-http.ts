import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { descriptorVersion, normalize } from '../../runtime/similarity/features.mjs'
import { ensureDataStore, deleteImageRecord, setImageVisibility } from '../../server/db.ts'
import { stopSimilarityPreparation } from '../../server/similarity-preparation.ts'
import { snapshotLifetime } from '../../server/visual-similarity.ts'

stopSimilarityPreparation() // HTTP contracts do not need model downloads or a background process.
Object.assign(globalThis, { defineEventHandler })
const db = await ensureDataStore()
const insert = db.prepare(`INSERT INTO images (id, filename, mime_type, size_bytes, created_at, content_hash, hidden_from_gallery)
  VALUES (?, ?, 'image/png', 1, '2026-01-01', ?, ?)`)
const feature = db.prepare('INSERT INTO image_visual_features VALUES (?, ?, ?, ?, ?)')
const values = { embedding: normalize(new Array(384).fill(1)), palette: normalize(new Array(64).fill(1)), spatial: new Array(48).fill(0.5) }
const add = (id: string, status: 'ready' | 'failed' | null = 'ready', hidden = false) => {
  insert.run(id, id + '.png', id, Number(hidden))
  if (status) feature.run(id, descriptorVersion, id, status, status === 'ready' ? JSON.stringify(values) : null)
}
add('reference')
for (let i = 0; i < 55; i++) add(`candidate-${String(i).padStart(2, '0')}`)
add('hidden', 'ready', true)
const router = createRouter()
router.get('/api/images/:id/similar', (await import('../../server/api/images/[id]/similar.get.ts')).default)
router.post('/api/images/:id/similar/retry', (await import('../../server/api/images/[id]/similar/retry.post.ts')).default)
const app = createApp({ debug: false }); app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/images`
const request = (id = 'reference', query = '') => fetch(`${base}/${id}/similar${query}`)
const originalNow = Date.now
try {
  const response = await request()
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  const first = await response.json()
  assert.equal(first.state, 'ready'); assert.equal(first.images.length, 24)
  assert.equal(first.images[0].id, 'candidate-00'); assert.equal(first.nextOffset, 24)
  assert.equal(first.totalCount, 56); assert.equal(first.partial, false)
  assert.ok(!JSON.stringify(first).includes('embedding'))
  assert.equal((await request('hidden')).status, 404)
  assert.equal((await request('missing')).status, 404)
  for (const query of ['?offset=2', '?snapshot=bad', '?offset=-1', `?snapshot=${first.snapshot}&offset=999`, `?snapshot=${first.snapshot}&offset=1.5`]) assert.equal((await request('reference', query)).status, 400)
  add('aaa-new')
  setImageVisibility('candidate-24', true)
  deleteImageRecord('candidate-25')
  assert.equal(db.prepare('SELECT image_id FROM image_visual_features WHERE image_id = ?').get('candidate-25'), undefined)
  const second = await (await request('reference', `?snapshot=${first.snapshot}&offset=24`)).json()
  assert.equal(second.images.length, 24); assert.equal(second.images[0].id, 'candidate-26')
  assert.ok(!second.images.some((row: { id: string }) => ['aaa-new', 'hidden', 'candidate-24', 'candidate-25', 'reference'].includes(row.id)))
  const last = await (await request('reference', `?snapshot=${first.snapshot}&offset=${second.nextOffset}`)).json()
  assert.equal(last.nextOffset, null)
  assert.equal(new Set([...first.images, ...second.images, ...last.images].map(image => image.id)).size, 53)
  const refreshed = await (await request()).json()
  assert.equal(refreshed.images[0].id, 'aaa-new')
  assert.equal((await request('candidate-00', `?snapshot=${first.snapshot}&offset=24`)).status, 410)
  Date.now = () => originalNow() + snapshotLifetime + 1
  assert.equal((await request('reference', `?snapshot=${first.snapshot}&offset=24`)).status, 410)
  Date.now = originalNow
  add('pending', null)
  assert.equal((await (await request('pending')).json()).state, 'preparing')
  add('failed', 'failed')
  assert.equal((await (await request('failed')).json()).state, 'failed')
  assert.equal((await fetch(`${base}/failed/similar/retry`, { method: 'POST' })).status, 200)
  assert.equal(db.prepare('SELECT status FROM image_visual_features WHERE image_id = ?').get('failed'), undefined)
  const partial = await (await request()).json()
  assert.equal(partial.partial, true)
  feature.run('pending', descriptorVersion, 'pending', 'ready', JSON.stringify(values))
  feature.run('failed', descriptorVersion, 'failed', 'ready', JSON.stringify(values))
  const completedDuringPaging = await (await request('reference', `?snapshot=${partial.snapshot}&offset=24`)).json()
  assert.equal(completedDuringPaging.partial, true, 'newly prepared images require explicit refresh of the frozen ranking')
  assert.equal((await (await request()).json()).partial, false)
  // Stale feature hashes cannot participate, even if their status was ready.
  db.prepare('UPDATE images SET content_hash = ? WHERE id = ?').run('changed', 'aaa-new')
  const stale = await (await request()).json()
  assert.ok(!stale.images.some((image: { id: string }) => image.id === 'aaa-new'))
  // Corrupted derivatives fail safely and can be explicitly prepared again.
  db.prepare('UPDATE image_visual_features SET features_json = ? WHERE image_id = ?').run('{broken', 'reference')
  assert.equal((await (await request()).json()).state, 'failed')
  await fetch(`${base}/reference/similar/retry`, { method: 'POST' })
  assert.equal(db.prepare('SELECT status FROM image_visual_features WHERE image_id = ?').get('reference'), undefined)
  assert.ok(db.prepare('SELECT id FROM images WHERE id = ?').get('reference'))
  assert.equal((await fetch(`${base}/hidden/similar/retry`, { method: 'POST' })).status, 404)
  console.log('Similarity contract and lifecycle assertions passed')
} finally {
  Date.now = originalNow
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  db.close()
}
