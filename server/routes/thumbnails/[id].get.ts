import { createError, getRouterParam, getQuery } from 'h3'
import { ensureDataStore, thumbnailVersion, type ImageRow } from '../../db.ts'
import { sendThumbnail } from '../../thumbnails.ts'

export default defineEventHandler(async event => {
  const db = await ensureDataStore()
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(getRouterParam(event, 'id') ?? '') as ImageRow | undefined
  const query = getQuery(event)
  if (!row || query.v !== thumbnailVersion || query.hash !== row.content_hash) {
    throw createError({ statusCode: 404, statusMessage: 'Preview not found.' })
  }
  return sendThumbnail(event, row)
})
