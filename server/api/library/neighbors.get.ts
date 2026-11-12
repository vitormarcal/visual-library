import { createError, getQuery } from 'h3'
import { browseCriteria, browseNeighbors } from '../../library-browse.ts'
export default defineEventHandler(event => {
  const query = getQuery(event)
  if (typeof query.id !== 'string' || !query.id || query.id.length > 100) throw createError({ statusCode: 400, statusMessage: 'Invalid image.' })
  return browseNeighbors(query.id, browseCriteria(query))
})
