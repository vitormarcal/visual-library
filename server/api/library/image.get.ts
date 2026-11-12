import { createError, getQuery } from 'h3'
import { browseImage } from '../../library-browse.ts'
export default defineEventHandler(event => {
  const id = getQuery(event).id
  if (typeof id !== 'string' || !id || id.length > 100) throw createError({ statusCode: 400, statusMessage: 'Invalid image.' })
  return browseImage(id)
})
