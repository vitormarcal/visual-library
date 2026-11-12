import { createError, getQuery } from 'h3'
import { rediscoveryImages } from '../../library-browse.ts'
export default defineEventHandler(event => {
  const previous = getQuery(event).previous
  const ids = previous === undefined ? [] : Array.isArray(previous) ? previous : [previous]
  if (ids.length > 8 || ids.some(id => typeof id !== 'string' || id.length > 100)) throw createError({ statusCode: 400, statusMessage: 'Invalid selection.' })
  return rediscoveryImages(ids as string[])
})
