import { getRouterParam, setHeader } from 'h3'
import { retrySimilarImage } from '../../../../visual-similarity.ts'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  return retrySimilarImage(getRouterParam(event, 'id') ?? '')
})
