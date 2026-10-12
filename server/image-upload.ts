import { createError, getRequestHeader, type H3Event } from 'h3'
import { sizeError, type SaveImageInput } from './image-url.ts'
import { validateImageFormat } from './image-format.ts'

export const defaultImageSizeBytes = 15 * 1024 * 1024
export const parseImageSizeLimit = (value: unknown) => {
  const limit = Number(value)
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('maxImageSizeBytes must be a positive safe integer')
  return limit
}
export const imageSizeLimit = (event: H3Event) => parseImageSizeLimit(useRuntimeConfig(event).public.maxImageSizeBytes)
const badForm = () => createError({ statusCode: 400, statusMessage: 'Invalid image form.' })

// Do not destroy the incoming socket on overflow: H3 must still deliver the 413.
export const readLimitedRequest = async (event: H3Event, limit: number) => {
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (declared > limit) { event.node.req.resume(); throw sizeError(limit) }
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const req = event.node.req
    const cleanup = () => { req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted) }
    const error = (err: Error) => { cleanup(); reject(err) }
    const aborted = () => error(badForm())
    const end = () => { cleanup(); resolve(Buffer.concat(chunks, size)) }
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) { cleanup(); req.resume(); reject(sizeError(limit)); return }
      chunks.push(chunk)
    }
    req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', aborted)
  })
}

export const readImageForm = async (event: H3Event, external = false) => {
  const limit = imageSizeLimit(event)
  const contentType = getRequestHeader(event, 'content-type') ?? ''
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw createError({ statusCode: 415, statusMessage: 'Use multipart/form-data.' })
  const bytes = await readLimitedRequest(event, limit + 64 * 1024)
  let form: FormData
  try { form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData() }
  catch { throw badForm() }
  const images = form.getAll('image')
  if (images.length !== 1 || !(images[0] instanceof File) || !images[0].size) throw badForm()
  const image = images[0]
  if (image.size > limit) throw sizeError(limit)
  if (image.name.length > 1024) throw badForm()
  let source = 'visual-library', hiddenFromGallery = false
  if (external) {
    for (const key of form.keys()) if (!['image', 'source', 'hiddenFromGallery'].includes(key) || form.getAll(key).length !== 1) throw badForm()
    const suppliedSource = form.get('source')
    if (suppliedSource !== null) {
      if (typeof suppliedSource !== 'string') throw badForm()
      source = suppliedSource.trim()
      if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(source)) throw badForm()
    }
    const hidden = form.get('hiddenFromGallery')
    if (hidden !== null && hidden !== 'true' && hidden !== 'false') throw badForm()
    hiddenFromGallery = hidden === 'true'
  }
  const data = Buffer.from(await image.arrayBuffer())
  const format = validateImageFormat(data)
  const input: SaveImageInput = { data, originalName: image.name || null, mimeType: format.mimeType, sourceUrl: null }
  return { input, source, hiddenFromGallery }
}
