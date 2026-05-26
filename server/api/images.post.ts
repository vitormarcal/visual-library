import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { createError, getRequestHeader, readBody, readMultipartFormData, type H3Event } from 'h3'
import { ensureDataStore, hashImageBytes, imageDir, toImageResponse, type ImageRow } from '../db'
import {
  fetchRemoteImage,
  imageMimeTypes,
  maxImageSizeBytes,
  normalizeUrlSaveError,
  publicUrlError,
  sizeError,
  type SaveImageInput,
} from '../image-url'

const imageExtensions = ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']

const duplicateResponse = () => ({
  duplicate: true,
  message: 'Already saved.',
})

const isContentHashUniqueError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.message.includes('SQLITE_CONSTRAINT_UNIQUE') ||
    error.message.includes('UNIQUE constraint failed: images.content_hash')
  )
}

const hasImageExtension = (name: string | undefined) => {
  const extension = name ? extname(name).toLowerCase() : ''
  return imageExtensions.includes(extension)
}

const isImagePart = (part: NonNullable<Awaited<ReturnType<typeof readMultipartFormData>>>[number]) => {
  return part.name === 'image' && (imageMimeTypes.includes(part.type ?? '') || hasImageExtension(part.filename))
}

const extensionFor = (name: string | undefined, mimeType: string) => {
  const originalExtension = name ? extname(name).toLowerCase() : ''

  if (imageExtensions.includes(originalExtension)) {
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

  if (mimeType === 'image/avif') {
    return '.avif'
  }

  return ''
}

const readLocalImage = async (event: H3Event): Promise<SaveImageInput> => {
  const parts = await readMultipartFormData(event)
  const image = parts?.find(isImagePart)

  if (!image || !image.data.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported file type. Use JPEG, PNG, WebP, GIF, or AVIF.',
    })
  }

  if (image.data.length > maxImageSizeBytes) {
    throw sizeError()
  }

  return {
    data: image.data,
    originalName: image.filename ?? null,
    mimeType: image.type || 'application/octet-stream',
    sourceUrl: null,
  }
}

export default defineEventHandler(async (event) => {
  const contentType = getRequestHeader(event, 'content-type') ?? ''
  let input: SaveImageInput

  if (contentType.includes('application/json')) {
    const body = await readBody<{ url?: unknown }>(event)
    const url = typeof body.url === 'string' ? body.url.trim() : ''

    if (!url) {
      throw publicUrlError()
    }

    try {
      input = await fetchRemoteImage(url)
    } catch (error) {
      normalizeUrlSaveError(error)
    }
  } else {
    input = await readLocalImage(event)
  }

  const db = await ensureDataStore()
  const contentHash = hashImageBytes(input.data)
  const existing = db
    .prepare('SELECT id FROM images WHERE content_hash = ? LIMIT 1')
    .get(contentHash) as { id: string } | undefined

  if (existing) {
    return duplicateResponse()
  }

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const filename = `${id}${extensionFor(input.originalName ?? undefined, input.mimeType)}`
  const path = `${imageDir}/${filename}`

  await writeFile(path, input.data)

  try {
    db.prepare(`
      INSERT INTO images (id, filename, original_name, mime_type, size_bytes, created_at, source_url, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, filename, input.originalName, input.mimeType, input.data.length, createdAt, input.sourceUrl, contentHash)
  } catch (error) {
    await unlink(path).catch(() => {})

    if (isContentHashUniqueError(error)) {
      return duplicateResponse()
    }

    throw error
  }

  const row = db
    .prepare('SELECT * FROM images WHERE id = ?')
    .get(id) as ImageRow

  return toImageResponse(row)
})
