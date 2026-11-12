import { createError, getQuery } from 'h3'
import { relatedPage } from '../../library-browse.ts'
export default defineEventHandler(event => {
  const query = getQuery(event), offset = query.offset === undefined ? undefined : Number(query.offset)
  if (typeof query.id !== 'string' || !query.id || query.id.length > 100
    || (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0))) throw createError({ statusCode: 400, statusMessage: 'Invalid related images.' })
  return relatedPage(query.id, offset)
})
