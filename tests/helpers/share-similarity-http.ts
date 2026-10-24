import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createApp, createRouter, defineEventHandler, type H3Event, toNodeListener } from 'h3'

const hooks = new Map<string, (event?: H3Event) => void>()
Object.assign(globalThis, {
  defineEventHandler,
  defineNitroPlugin: (plugin: unknown) => plugin,
  useRuntimeConfig: () => ({ public: { maxImageSizeBytes: 1024 } }),
})
await mkdir('runtime/similarity', { recursive: true })
// Exercise the real fork/coalescing lifecycle, with no ML dependency or model download.
await writeFile('runtime/similarity/worker.mjs', `
import { appendFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/library.sqlite', { readOnly: true })
const ids = db.prepare('SELECT id FROM images ORDER BY id').all().map(row => row.id)
appendFileSync('worker-events.jsonl', JSON.stringify({ event: 'start', pid: process.pid, ids }) + '\\n')
await new Promise(resolve => setTimeout(resolve, 250))
db.close()
appendFileSync('worker-events.jsonl', JSON.stringify({ event: 'end', pid: process.pid }) + '\\n')
process.exit(0)
`)
const { ensureDataStore } = await import('../../server/db.ts')
const db = await ensureDataStore()
const { default: plugin } = await import('../../server/plugins/similarity.ts')
plugin({ hooks: { hook: (name: string, callback: (event?: H3Event) => void) => hooks.set(name, callback) } })
const router = createRouter()
router.post('/share', (await import('../../server/routes/share.post.ts')).default)
const app = createApp({ debug: false, onAfterResponse: event => hooks.get('afterResponse')?.(event) }); app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
const realFetch = globalThis.fetch
const fixture = (name: string) => readFile(new URL(`../fixtures/images/${name}`, import.meta.url))
const gif = await fixture('tiny.gif')
globalThis.fetch = async (input, init) => input instanceof URL && input.hostname === '93.184.216.34'
  ? new Response(input.pathname === '/image.gif' ? gif : '<html>A post</html>') : realFetch(input, init)
const events = async () => {
  try { return (await readFile('worker-events.jsonl', 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }
  catch { return [] }
}
const running = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (predicate: () => Promise<boolean>) => {
  for (let i = 0; i < 300; i++) { if (await predicate()) return; await sleep(10) }
  throw new Error('Worker lifecycle timed out')
}
const starts = async () => (await events()).filter(event => event.event === 'start')
const waitIdle = async (count: number) => waitFor(async () => {
  const all = await events(), started = all.filter(event => event.event === 'start')
  return started.length === count && all.filter(event => event.event === 'end').length === count && started.every(event => !running(event.pid))
})
const send = async (form: FormData | string) => {
  const response = await fetch(base + '/share', { method: 'POST', body: form, redirect: 'manual' })
  assert.equal(response.status, 303)
  const result = new URL(response.headers.get('location')!, base).searchParams
  await response.arrayBuffer()
  return result
}
const formFor = (bytes: Buffer, name: string) => { const form = new FormData(); form.append('image', new Blob([bytes]), name); return form }
try {
  // Initial preparation must already have exited; otherwise it could mask the missing hook.
  await waitIdle(1)
  assert.deepEqual((await starts())[0].ids, [])
  const png = await fixture('tiny.png')
  assert.equal((await send(formFor(png, 'shared.png'))).get('saved'), '1')
  await waitFor(async () => (await starts()).length === 2)
  const fresh = (await starts())[1]
  assert.equal(fresh.ids.length, 1)
  assert.ok(running(fresh.pid), 'capture must respond before worker completion')
  await waitIdle(2)
  assert.equal((await send(formFor(png, 'duplicate.png'))).get('duplicates'), '1')
  assert.equal((await send('{}')).get('shared'), 'invalid')
  assert.equal((await send(formFor(Buffer.from('invalid'), 'invalid.png'))).get('failed'), '1')
  await sleep(100)
  assert.equal((await starts()).length, 2)

  const link = new FormData(); link.set('text', 'https://93.184.216.34/image.gif')
  assert.equal((await send(link)).get('saved'), '1')
  await waitIdle(3)
  assert.equal((await starts())[2].ids.length, 2)
  assert.equal((await send(link)).get('duplicates'), '1')
  link.set('text', 'https://93.184.216.34/post')
  assert.equal((await send(link)).get('failed'), '1')
  await sleep(100); assert.equal((await starts()).length, 3)

  const partial = formFor(await fixture('tiny.jpg'), 'new.jpg')
  partial.append('image', new Blob(['invalid']), 'invalid.png')
  const result = await send(partial)
  assert.equal(result.get('saved'), '1'); assert.equal(result.get('failed'), '1')
  await waitIdle(4)
  assert.equal((await starts())[3].ids.length, 3)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM images').get()!.n, 3)
} finally {
  globalThis.fetch = realFetch
  hooks.get('close')?.()
  await new Promise<void>(resolve => server.close(() => resolve()))
  db.close()
}
