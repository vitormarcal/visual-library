import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { createError, readMultipartFormData } from 'h3'
import { ensureDataStore, imageDir, toImageResponse, type ImageRow } from '../db'

const maxImageSizeBytes = 15 * 1024 * 1024
const imageExtensions = ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']
const imageMimeTypes = ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']

const hasImageExtension = (name: string | undefined) => {
  const extension = name ? extname(name).toLowerCase() : ''
  return imageExtensions.includes(extension)
}

const isImagePart = (part: NonNullable<Awaited<ReturnType<typeof readMultipartFormData>>>[number]) => {
  return part.name === 'image' && (imageMimeTypes.includes(part.type ?? '') || hasImageExtension(part.filename))
}

const extensionFor = (name: string | undefined, mimeType: string) => {
  const originalExtension = name ? extname(name).toLowerCase() : ''

  if (originalExtension && /^[a-z0-9.]+$/.test(originalExtension)) {
    return originalExtension
  }

  if (mimeType === 'image/jpeg') {
    return '.jpg'
  }

  if (mimeType === 'image/png') {
    return '.png'
  }

  if (mimeType === 'image/gif') {
    return '.gif'
  }

  if (mimeType === 'image/webp') {
    return '.webp'
  }

  return ''
}

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const image = parts?.find(isImagePart)

  if (!image || !image.data.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported file type. Use JPEG, PNG, WebP, GIF, or AVIF.',
    })
  }

  if (image.data.length > maxImageSizeBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Image is too large. Maximum size is 15 MB.',
    })
  }

  const db = await ensureDataStore()
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const mimeType = image.type || 'application/octet-stream'
  const filename = `${id}${extensionFor(image.filename, mimeType)}`
  const path = `${imageDir}/${filename}`

  await writeFile(path, image.data)

  try {
    db.prepare(`
      INSERT INTO images (id, filename, original_name, mime_type, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, filename, image.filename ?? null, mimeType, image.data.length, createdAt)
  } catch (error) {
    await unlink(path).catch(() => {})
    throw error
  }

  const row = db
    .prepare('SELECT * FROM images WHERE id = ?')
    .get(id) as ImageRow

  return toImageResponse(row)
})
