import { createHash } from 'node:crypto'
import { getRequestHeader } from 'h3'
import { toImageResponse } from '../db.ts'
import { fetchRemoteImage, normalizeUrlSaveError, publicUrlError, parseRemoteUrl, type SaveImageInput } from '../image-url.ts'
import { imageSizeLimit, readCaptureTags, readImageForm, readLimitedRequest } from '../image-upload.ts'
import { saveImage } from '../image-storage.ts'

export default defineEventHandler(async (event) => {
  let input: SaveImageInput
  let tags: string[] = []
  let sourceReference: { entityType: string; entityId: string; url: string } | undefined
  if ((getRequestHeader(event, 'content-type') ?? '').includes('application/json')) {
    let body: { url?: unknown; tags?: unknown; pageUrl?: unknown }
    try { body = JSON.parse((await readLimitedRequest(event, 64 * 1024)).toString()) } catch { throw publicUrlError() }
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!url) throw publicUrlError()
    tags = readCaptureTags(body.tags)
    if (body.pageUrl !== undefined) {
      if (typeof body.pageUrl !== 'string' || body.pageUrl.length > 8192) throw publicUrlError()
      const page = parseRemoteUrl(body.pageUrl).href
      sourceReference = { entityType: 'web-page', entityId: createHash('sha256').update(page).digest('hex'), url: page }
    }
    try { input = await fetchRemoteImage(url, imageSizeLimit(event)) } catch (error) { normalizeUrlSaveError(error) }
  } else {
    const form = await readImageForm(event)
    input = form.input
    tags = form.enrichment?.tags ?? []
  }
  const result = await saveImage(input!, 'visual-library', false, { tags, sourceReference }, false)
  return result.created ? toImageResponse(result.row) : { duplicate: true, message: 'Already saved.' }
})
