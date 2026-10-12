import { randomUUID } from 'node:crypto'
import { open, unlink } from 'node:fs/promises'
import { createError } from 'h3'
import { ensureDataStore, enrichImageWithinTransaction, hashImageBytes, imageDir, type AssetEnrichment, type ImageRow } from './db.ts'
import { validateImageFormat } from './image-format.ts'
import type { SaveImageInput } from './image-url.ts'

export const saveImage = async (input: SaveImageInput, source = 'visual-library', hiddenFromGallery = false, enrichment?: AssetEnrichment) => {
  const format = validateImageFormat(input.data)
  let path: string | undefined, owned = false
  try {
    const db = await ensureDataStore()
    const hash = hashImageBytes(input.data)
    const find = () => db.prepare('SELECT * FROM images WHERE content_hash = ?').get(hash) as ImageRow | undefined
    const reuse = (id: string) => {
      db.exec('BEGIN')
      try {
        const row = db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow | undefined
        if (!row) throw new Error('Image disappeared during upload')
        enrichImageWithinTransaction(id, source, enrichment)
        db.exec('COMMIT')
        return { row, created: false }
      } catch (error) { db.exec('ROLLBACK'); throw error }
    }
    const existing = find()
    if (existing) return reuse(existing.id)
    const id = randomUUID(), filename = `${id}${format.extension}`
    path = `${imageDir}/${filename}`
    const file = await open(path, 'wx')
    owned = true
    try { await file.writeFile(input.data) } finally { await file.close() }
    db.exec('BEGIN')
    try {
      db.prepare(`INSERT INTO images (id, filename, original_name, mime_type, size_bytes, created_at, source_url, content_hash, source, hidden_from_gallery)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, filename, input.originalName, format.mimeType, input.data.length, new Date().toISOString(), input.sourceUrl, hash, source, Number(hiddenFromGallery))
      enrichImageWithinTransaction(id, source, enrichment)
      const row = db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow
      db.exec('COMMIT')
      owned = false // Persisted image and enrichment survive a lost response.
      return { row, created: true }
    } catch (error) {
      db.exec('ROLLBACK')
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: images.content_hash')) {
        await unlink(path); owned = false
        const winner = find()
        if (winner) return reuse(winner.id)
      }
      throw error
    }
  } catch (error) {
    let cleanupFailed = false
    if (owned && path) {
      try { await unlink(path) } catch (cleanupError) { cleanupFailed = true; console.error('Image upload cleanup failed', cleanupError) }
    }
    if (!cleanupFailed && error instanceof Error && ['Too many tags', 'Tag is too long'].includes(error.message)) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
    console.error('Image save failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Could not store image.' })
  }
}
