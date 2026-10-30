import { createError, getRouterParam } from 'h3'
import { ensureDataStore, type ImageRow } from '../../db.ts'
import { sendImageContent } from '../../image-content.ts'
export default defineEventHandler(async event => {
  const token = getRouterParam(event, 'token') ?? ''
  if (!/^[\w-]{43}$/.test(token)) throw createError({ statusCode: 404, statusMessage: 'Image unavailable.' })
  const db = await ensureDataStore()
  const row = db.prepare('SELECT i.* FROM images i INNER JOIN (SELECT image_id,token FROM image_public_links UNION ALL SELECT image_id,token FROM image_public_link_aliases) p ON p.image_id = i.id WHERE p.token = ?').get(token) as ImageRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Image unavailable.' })
  return sendImageContent(event, row, true)
})
