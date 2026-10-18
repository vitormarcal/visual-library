import { getRequestHeader, sendRedirect, setResponseHeader } from 'h3'
import { imageSizeLimit, readLimitedRequest } from '../image-upload.ts'
import { validateImageFormat } from '../image-format.ts'
import { fetchRemoteImage } from '../image-url.ts'
import { saveImage } from '../image-storage.ts'
import { sharedImageUrl } from '../../app/utils/shared-capture.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const redirect = (params: Record<string, string>) => sendRedirect(event, `/?${new URLSearchParams({ view: 'library', ...params })}`, 303)
  const contentType = getRequestHeader(event, 'content-type') ?? ''
  if (!/^multipart\/form-data\s*;/i.test(contentType)) return redirect({ shared: 'invalid' })
  const limit = imageSizeLimit(event)
  let form: FormData
  try {
    // Bound the entire share, including multi-file batches, before parsing it.
    const bytes = await readLimitedRequest(event, limit + 64 * 1024)
    form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData()
  } catch (error) {
    return redirect({ shared: (error as { statusCode?: number }).statusCode === 413 ? 'too-large' : 'invalid' })
  }
  const files = form.getAll('image')
  if (files.length > 20 || files.some(file => !(file instanceof File))) return redirect({ shared: 'invalid' })
  let saved = 0, duplicates = 0, failed = 0
  if (files.length) {
    // File shares take precedence over an accompanying source-page URL.
    for (const file of files as File[]) {
      try {
        if (!file.size || file.size > limit || file.name.length > 1024) throw new Error('Invalid image')
        const data = Buffer.from(await file.arrayBuffer())
        const format = validateImageFormat(data)
        const result = await saveImage({ data, originalName: file.name || null, mimeType: format.mimeType, sourceUrl: null }, 'visual-library', false, { tags: [] }, false)
        if (result.created) saved++
        else duplicates++
      } catch { failed++ }
    }
  } else {
    const url = sharedImageUrl(form)
    if (!url) return redirect({ shared: 'invalid' })
    try {
      const input = await fetchRemoteImage(url, limit)
      const result = await saveImage(input, 'visual-library', false, { tags: [] }, false)
      if (result.created) saved++
      else duplicates++
    } catch { failed++ }
  }
  return redirect({ shared: 'result', saved: String(saved), duplicates: String(duplicates), failed: String(failed) })
})
