import { getQuery } from 'h3'
import { browseCriteria, browseImages } from '../../library-browse.ts'
export default defineEventHandler(event => {
  const query = getQuery(event)
  return browseImages(browseCriteria(query), query.cursor, query.limit === undefined ? 60 : Number(query.limit))
})
