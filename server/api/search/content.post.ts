import { setResponseHeader } from 'h3'
import { readLimitedRequest } from '../../image-upload.ts'
import { createError } from 'h3'
import { contentSearch } from '../../content-search.ts'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  let body
  try { body = JSON.parse((await readLimitedRequest(event, 4096)).toString()) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Invalid content search.' }) }
  return contentSearch(body)
})
