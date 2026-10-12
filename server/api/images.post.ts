import { getRequestHeader } from 'h3'
import { toImageResponse } from '../db.ts'
import { fetchRemoteImage, normalizeUrlSaveError, publicUrlError, type SaveImageInput } from '../image-url.ts'
import { imageSizeLimit, readImageForm, readLimitedRequest } from '../image-upload.ts'
import { saveImage } from '../image-storage.ts'

export default defineEventHandler(async (event) => {
  let input: SaveImageInput
  if ((getRequestHeader(event, 'content-type') ?? '').includes('application/json')) {
    let body: { url?: unknown }
    try { body = JSON.parse((await readLimitedRequest(event, 64 * 1024)).toString()) } catch { throw publicUrlError() }
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!url) throw publicUrlError()
    try { input = await fetchRemoteImage(url, imageSizeLimit(event)) } catch (error) { normalizeUrlSaveError(error) }
  } else input = (await readImageForm(event)).input
  const result = await saveImage(input!)
  return result.created ? toImageResponse(result.row) : { duplicate: true, message: 'Already saved.' }
})
