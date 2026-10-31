import { createError } from 'h3'
import { fetchRemoteContent, remoteContentImage } from '../image-url.ts'
import { imageSizeLimit, readCaptureTags, readLimitedRequest } from '../image-upload.ts'
import { discoverPageImages } from '../page-images.ts'
import { saveImage } from '../image-storage.ts'
import { toImageResponse } from '../db.ts'
export default defineEventHandler(async event => {
  let body: { url?: unknown; tags?: unknown }
  try { body = JSON.parse((await readLimitedRequest(event, 64 * 1024)).toString()) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid URL request.' }) }
  if (!body || typeof body.url !== 'string' || body.url.length > 8192) throw createError({ statusCode: 400, statusMessage: 'Invalid URL.' })
  const tags = readCaptureTags(body.tags)
  let content: Awaited<ReturnType<typeof fetchRemoteContent>>
  try { content = await fetchRemoteContent(body.url, imageSizeLimit(event), true) }
  catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    throw createError({ statusCode: status ?? 502, statusMessage: status === 413 ? 'This page or image is too large.' : status === 408 ? 'This page took too long to respond. Try again.' : 'Could not read this public URL. The page may be unavailable or require sign-in.' })
  }
  if (!content.html && content.data.length > imageSizeLimit(event)) throw createError({ statusCode: 413, statusMessage: 'Image is too large.' })
  if (content.html) return { kind: 'page', ...discoverPageImages(content.data.toString('utf8'), content.url) }
  const result = await saveImage(remoteContentImage(content, body.url), 'visual-library', false, { tags }, false)
  event.context.sharedImagesCreated = result.created
  return { kind: 'image', result: result.created ? toImageResponse(result.row) : { duplicate: true, message: 'Already saved.' } }
})
