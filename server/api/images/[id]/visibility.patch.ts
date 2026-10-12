import { createError, getRouterParam } from 'h3'
import { ensureDataStore, setImageVisibility, toImageResponse } from '../../../db.ts'
import { readLimitedRequest } from '../../../image-upload.ts'
export default defineEventHandler(async (event) => {
  let body
  try { body = JSON.parse((await readLimitedRequest(event, 1024)).toString()) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid visibility.' }) }
  if (!body || Object.keys(body).length !== 1 || typeof body.hiddenFromGallery !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Invalid visibility.' })
  await ensureDataStore()
  const row = setImageVisibility(getRouterParam(event, 'id') ?? '', body.hiddenFromGallery)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  return toImageResponse(row)
})
