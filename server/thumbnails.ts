import { execFile } from 'node:child_process'
import { access, open, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createError, getRequestHeader, sendRedirect, sendStream, setHeader, setResponseStatus, type H3Event } from 'h3'
import { ensureDataStore, imageDir, thumbnailVersion, type ImageRow } from './db.ts'

const root = join(process.cwd(), 'data', 'thumbnails')
const runtime = join(process.cwd(), 'runtime/similarity/thumbnail.mjs')
const pending = new Map<string, Promise<void>>()
const failedUntil = new Map<string, number>()
let tail = Promise.resolve()
const exists = async (path: string) => access(path).then(() => true, () => false)
export const removeThumbnails = (id: string) => rm(join(root, id), { recursive: true, force: true })

async function prepare(row: ImageRow, path: string) {
  if (await exists(path)) return
  const current = pending.get(path)
  if (current) return current
  if ((failedUntil.get(path) ?? 0) > Date.now()) throw new Error('Preview unavailable')
  // Serialize native decoding; coalesce requests for the same immutable derivative.
  const job = tail.then(async () => {
    const db = await ensureDataStore()
    if (!db.prepare('SELECT id FROM images WHERE id = ? AND content_hash = ?').get(row.id, row.content_hash)) throw new Error('Image removed')
    if (await exists(path)) return
    await new Promise<void>((resolve, reject) => {
      execFile(process.execPath, ['--max-old-space-size=128', runtime, join(imageDir, row.filename), path, row.content_hash!],
        { timeout: 15_000, killSignal: 'SIGKILL', maxBuffer: 4096 }, error => error ? reject(error) : resolve())
    })
    if (!db.prepare('SELECT id FROM images WHERE id = ? AND content_hash = ?').get(row.id, row.content_hash)) {
      await removeThumbnails(row.id)
      throw new Error('Image removed')
    }
  })
  pending.set(path, job)
  tail = job.catch(() => {})
  try { await job }
  catch (error) {
    // Bounded, transient failure cache: invalid images cannot repeatedly spawn decoders.
    if (failedUntil.size >= 256) failedUntil.delete(failedUntil.keys().next().value!)
    failedUntil.set(path, Date.now() + 60_000)
    throw error
  } finally { pending.delete(path) }
}

export async function sendThumbnail(event: H3Event, row: ImageRow) {
  if (!row.content_hash || !/^[a-f0-9]{64}$/.test(row.content_hash)) {
    setHeader(event, 'Cache-Control', 'no-store')
    return sendRedirect(event, `/images/${encodeURIComponent(row.filename)}`, 302)
  }
  const path = join(root, row.id, `${thumbnailVersion}-${row.content_hash}.webp`)
  try { await prepare(row, path) }
  catch {
    const db = await ensureDataStore()
    if (!db.prepare('SELECT id FROM images WHERE id = ?').get(row.id)) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
    setHeader(event, 'Cache-Control', 'no-store')
    return sendRedirect(event, `/images/${encodeURIComponent(row.filename)}`, 302)
  }
  let file
  try { file = await open(path, 'r') }
  catch { throw createError({ statusCode: 404, statusMessage: 'Preview not found.' }) }
  let streaming = false
  try {
    const stat = await file.stat()
    const etag = `"${thumbnailVersion}-${row.content_hash}"`
    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'ETag', etag)
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    const match = getRequestHeader(event, 'if-none-match')
    if (match === '*' || match?.split(',').some(value => value.trim().replace(/^W\//, '') === etag)) {
      setResponseStatus(event, 304)
      return ''
    }
    setHeader(event, 'Content-Type', 'image/webp')
    setHeader(event, 'Content-Length', stat.size)
    const stream = file.createReadStream({ autoClose: true })
    const cancel = () => { if (!event.node.res.writableEnded) stream.destroy() }
    event.node.res.once('close', cancel)
    stream.once('close', () => event.node.res.off('close', cancel))
    streaming = true
    return await sendStream(event, stream)
  } finally { if (!streaming) await file.close() }
}
