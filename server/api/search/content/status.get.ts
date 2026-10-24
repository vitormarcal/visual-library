import { setResponseHeader } from 'h3'
import { contentSearchStatus } from '../../../content-search.ts'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return contentSearchStatus()
})
