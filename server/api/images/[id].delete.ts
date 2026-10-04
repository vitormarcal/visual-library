import { unlink } from 'node:fs/promises'
import { createError } from 'h3'
import { deleteImageRecord, ensureDataStore, imageDir, type ImageRow } from '../../db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing image id.',
    })
  }

  const db = await ensureDataStore()
  const row = db
    .prepare('SELECT * FROM images WHERE id = ?')
    .get(id) as ImageRow | undefined

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Image not found.',
    })
  }

  deleteImageRecord(id)
  await unlink(`${imageDir}/${row.filename}`).catch(() => {})

  return { ok: true }
})
