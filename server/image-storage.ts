import { randomUUID } from 'node:crypto'
import { open, unlink } from 'node:fs/promises'
import { createError } from 'h3'
import { ensureDataStore, hashImageBytes, imageDir, type ImageRow } from './db.ts'
import { validateImageFormat } from './image-format.ts'
import type { SaveImageInput } from './image-url.ts'

export const saveImage = async (input: SaveImageInput, source = 'visual-library', hiddenFromGallery = false) => {
  const format = validateImageFormat(input.data)
  const db = await ensureDataStore()
  const hash = hashImageBytes(input.data)
  const find = () => db.prepare('SELECT * FROM images WHERE content_hash = ?').get(hash) as ImageRow | undefined
  const existing = find()
  if (existing) return { row: existing, created: false }
  const id = randomUUID(), filename = `${id}${format.extension}`
  const path = `${imageDir}/${filename}`
  let owned = false
  try {
    const file = await open(path, 'wx')
    owned = true
    try { await file.writeFile(input.data) } finally { await file.close() }
    try {
      db.prepare(`INSERT INTO images (id, filename, original_name, mime_type, size_bytes, created_at, source_url, content_hash, source, hidden_from_gallery)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, filename, input.originalName, format.mimeType, input.data.length, new Date().toISOString(), input.sourceUrl, hash, source, Number(hiddenFromGallery))
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: images.content_hash')) {
        await unlink(path); owned = false
        const winner = find()
        if (winner) return { row: winner, created: false }
      }
      throw error
    }
    owned = false // A persisted asset survives a lost response; retry returns its ID.
    return { row: db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow, created: true }
  } catch (error) {
    if (owned) {
      try { await unlink(path) } catch (cleanupError) { console.error('Image upload cleanup failed', cleanupError) }
    }
    console.error('Image save failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Could not store image.' })
  }
}
