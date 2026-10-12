import { createError, getRouterParam } from 'h3'
import { ensureDataStore, type ImageRow } from '../../../db.ts'
import { sendImageContent } from '../../../image-content.ts'
export default defineEventHandler(async (event) => {
  const db = await ensureDataStore()
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(getRouterParam(event, 'id') ?? '') as ImageRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  return sendImageContent(event, row)
})
