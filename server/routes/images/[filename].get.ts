import { basename } from 'node:path'
import { createError, getRouterParam } from 'h3'
import { ensureDataStore, type ImageRow } from '../../db.ts'
import { sendImageContent } from '../../image-content.ts'
export default defineEventHandler(async (event) => {
  const requested = getRouterParam(event, 'filename')
  if (!requested) throw createError({ statusCode: 400, statusMessage: 'Missing image filename.' })
  const db = await ensureDataStore()
  const row = db.prepare('SELECT * FROM images WHERE filename = ?').get(basename(requested)) as ImageRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  return sendImageContent(event, row)
})
