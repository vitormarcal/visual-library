import { createError, getRouterParam } from 'h3'
import { ensureDataStore, findAssetImage } from '../../../db.ts'
import { sendImageContent } from '../../../image-content.ts'
export default defineEventHandler(async (event) => {
  await ensureDataStore()
  const requestedId = getRouterParam(event, 'id') ?? ''
  const row = findAssetImage(requestedId)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  return sendImageContent(event, row, false, requestedId !== row.id)
})
