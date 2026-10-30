import { createError, getRequestHeader, type H3Event } from 'h3'
import { sizeError, type SaveImageInput } from './image-url.ts'
import { normalizeTagValues, type AssetEnrichment, type SourceReference, type ManagedTagGroup } from './db.ts'
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
export const readLimitedRequest = async (event: H3Event, limit: number, timeoutMs?: number) => {
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (declared > limit) { event.node.req.resume(); throw sizeError(limit) }
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const req = event.node.req
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => { if (timer) clearTimeout(timer); req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted) }
    const error = (err: Error) => { cleanup(); reject(err) }
    const aborted = () => error(badForm())
    const end = () => { cleanup(); resolve(Buffer.concat(chunks, size)) }
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) { cleanup(); req.resume(); reject(sizeError(limit)); return }
      chunks.push(chunk)
    }
    if (timeoutMs !== undefined) {
      timer = setTimeout(() => { cleanup(); req.resume(); reject(createError({ statusCode: 408, statusMessage: 'Request body timed out.' })) }, timeoutMs)
      timer.unref()
    }
    req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', aborted)
  })
}

const parseJsonField = (value: FormDataEntryValue | null, maxBytes: number): unknown => {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > maxBytes) throw badForm()
  try { return JSON.parse(value) } catch { throw badForm() }
}

export const readCaptureTags = (value: unknown): string[] => {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(tag => typeof tag !== 'string')) throw badForm()
  try { return normalizeTagValues(value).map(tag => tag.name) }
  catch (error) { throw createError({ statusCode: 400, statusMessage: (error as Error).message }) }
}

const readEnrichment = (form: FormData): AssetEnrichment => {
  let tags: string[] = []
  if (form.has('tags')) {
    const value = parseJsonField(form.get('tags'), 64 * 1024)
    if (!Array.isArray(value) || value.some(tag => typeof tag !== 'string')) throw badForm()
    try { tags = normalizeTagValues(value).map(tag => tag.name) }
    catch (error) { throw createError({ statusCode: 400, statusMessage: (error as Error).message }) }
  }
  let sourceReference: SourceReference | undefined
  if (form.has('sourceReference')) {
    const value = parseJsonField(form.get('sourceReference'), 8192)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw badForm()
    const reference = value as Record<string, unknown>
    if (Object.keys(reference).some(key => !['entityType', 'entityId', 'url'].includes(key))
      || typeof reference.entityType !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(reference.entityType)
      || typeof reference.entityId !== 'string' || !reference.entityId.length || reference.entityId.length > 256
      || reference.entityId !== reference.entityId.trim() || /[\u0000-\u001f\u007f-\u009f]/.test(reference.entityId)) throw badForm()
    sourceReference = { entityType: reference.entityType, entityId: reference.entityId }
    if ('url' in reference) {
      if (typeof reference.url !== 'string' || reference.url.length > 2048 || reference.url !== reference.url.trim()) throw badForm()
      let url: URL
      try { url = new URL(reference.url) } catch { throw badForm() }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw badForm()
      sourceReference.url = reference.url
    }
  }
  let managedTags: Record<string, ManagedTagGroup> | undefined
  if (form.has('managedTags')) {
    if (!sourceReference) throw badForm()
    const value = parseJsonField(form.get('managedTags'), 8192)
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 4) throw badForm()
    managedTags = {}
    for (const [group, input] of Object.entries(value)) managedTags[group] = validateManagedTagGroup(group, input)
  }
  return { tags, sourceReference, managedTags }
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
    for (const key of form.keys()) if (!['image', 'source', 'hiddenFromGallery', 'tags', 'sourceReference', 'managedTags'].includes(key) || form.getAll(key).length !== 1) throw badForm()
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
  if (!external && form.getAll('tags').length > 1) throw badForm()
  const enrichment = external ? readEnrichment(form) : { tags: readCaptureTags(form.has('tags') ? parseJsonField(form.get('tags'), 64 * 1024) : undefined) }
  const data = Buffer.from(await image.arrayBuffer())
  const format = validateImageFormat(data)
  const input: SaveImageInput = { data, originalName: image.name || null, mimeType: format.mimeType, sourceUrl: null }
  return { input, source, hiddenFromGallery, enrichment }
}

export const validateManagedTagGroup = (group: unknown, input: unknown): ManagedTagGroup => {
  if (typeof group !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(group) || !input || typeof input !== 'object' || Array.isArray(input)) throw badForm()
  const value = input as Record<string, unknown>
  if (Object.keys(value).some(key => !['tags', 'revision'].includes(key)) || !Array.isArray(value.tags)
    || value.tags.some(tag => typeof tag !== 'string')
    || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0) throw badForm()
  return { tags: value.tags as string[], revision: Number(value.revision) }
}
