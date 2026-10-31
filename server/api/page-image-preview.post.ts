import { createError, setHeader } from 'h3'
import { fetchRemoteImage } from '../image-url.ts'
import { imageSizeLimit, readLimitedRequest } from '../image-upload.ts'
export default defineEventHandler(async event => {
  let url: unknown
  try { url = JSON.parse((await readLimitedRequest(event, 16 * 1024)).toString())?.url } catch { /* invalid body */ }
  if (typeof url !== 'string' || url.length > 8192) throw createError({ statusCode: 400, statusMessage: 'Invalid image URL.' })
  const image = await fetchRemoteImage(url, imageSizeLimit(event))
  setHeader(event, 'Content-Type', image.mimeType)
  setHeader(event, 'Cache-Control', 'no-store')
  return image.data
})
