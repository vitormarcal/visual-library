import { createError, getRouterParam, setHeader } from 'h3'
import { ensureDataStore, toAssetResponse, findAssetImage } from '../../db.ts'
export default defineEventHandler(async (event) => {
  await ensureDataStore()
  const requestedId = getRouterParam(event, 'id') ?? ''
  const row = findAssetImage(requestedId)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  setHeader(event, 'Cache-Control', 'no-store')
  return toAssetResponse(row, requestedId)
})
