import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { createError, sendStream, setHeader } from 'h3'
import { ensureDataStore, imageDir, type ImageRow } from '../../db'

export default defineEventHandler(async (event) => {
  const requested = getRouterParam(event, 'filename')

  if (!requested) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing image filename.',
    })
  }

  const filename = basename(decodeURIComponent(requested))
  const db = await ensureDataStore()
  const row = db
    .prepare('SELECT * FROM images WHERE filename = ?')
    .get(filename) as ImageRow | undefined

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Image not found.',
    })
  }

  const path = `${imageDir}/${row.filename}`

  try {
    await stat(path)
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: 'Image file not found.',
    })
  }

  setHeader(event, 'Content-Type', row.mime_type)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')

  return sendStream(event, createReadStream(path))
})
