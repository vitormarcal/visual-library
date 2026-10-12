import { createError, getRouterParam, setHeader } from 'h3'
import { ensureDataStore, toAssetResponse, type ImageRow } from '../../db.ts'
export default defineEventHandler(async (event) => {
  const db = await ensureDataStore()
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(getRouterParam(event, 'id') ?? '') as ImageRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  setHeader(event, 'Cache-Control', 'no-store')
  return toAssetResponse(row)
})
