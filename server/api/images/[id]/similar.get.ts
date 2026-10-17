import { getQuery, getRouterParam, setHeader } from 'h3'
import { similarImages } from '../../../visual-similarity.ts'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  return similarImages(getRouterParam(event, 'id') ?? '', getQuery(event))
})
