import { setResponseHeader } from 'h3'
import { activateSemanticSearch } from '../../../semantic-preparation.ts'
import { contentSearchStatus } from '../../../content-search.ts'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  await activateSemanticSearch()
  return contentSearchStatus()
})
