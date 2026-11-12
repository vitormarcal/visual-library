import { getQuery } from 'h3'
import { browseCriteria, browseIds } from '../../library-browse.ts'
export default defineEventHandler(event => browseIds(browseCriteria(getQuery(event))))
