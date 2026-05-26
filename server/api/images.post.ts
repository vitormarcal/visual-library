import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { unlink, writeFile } from 'node:fs/promises'
import { isIP } from 'node:net'
import { extname } from 'node:path'
import { createError, getRequestHeader, readBody, readMultipartFormData, type H3Event } from 'h3'
import { ensureDataStore, imageDir, toImageResponse, type ImageRow } from '../db'

const maxImageSizeBytes = 15 * 1024 * 1024
const remoteFetchTimeoutMs = 5000
const maxRedirects = 5
const imageExtensions = ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']
const imageMimeTypes = ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']

type SaveImageInput = {
  data: Buffer
  originalName: string | null
  mimeType: string
  sourceUrl: string | null
}

const hasImageExtension = (name: string | undefined) => {
  const extension = name ? extname(name).toLowerCase() : ''
  return imageExtensions.includes(extension)
}

const isImagePart = (part: NonNullable<Awaited<ReturnType<typeof readMultipartFormData>>>[number]) => {
  return part.name === 'image' && (imageMimeTypes.includes(part.type ?? '') || hasImageExtension(part.filename))
}

const extensionFor = (name: string | undefined, mimeType: string) => {
  const originalExtension = name ? extname(name).toLowerCase() : ''

  if (imageExtensions.includes(originalExtension)) {
    return originalExtension
  }

  if (mimeType === 'image/jpeg') {
    return '.jpg'
  }

  if (mimeType === 'image/png') {
    return '.png'
  }

  if (mimeType === 'image/gif') {
    return '.gif'
  }

  if (mimeType === 'image/webp') {
    return '.webp'
  }

  if (mimeType === 'image/avif') {
    return '.avif'
  }

  return ''
}

const publicUrlError = (statusCode = 400) => createError({
  statusCode,
  statusMessage: 'This image URL cannot be saved.',
})

const isExpectedUrlSaveError = (error: unknown) => {
  const statusMessage = (error as { statusMessage?: unknown }).statusMessage
  return statusMessage === 'This image URL cannot be saved.'
}

const isSizeError = (error: unknown) => {
  const statusCode = (error as { statusCode?: unknown }).statusCode
  const statusMessage = (error as { statusMessage?: unknown }).statusMessage
  return statusCode === 413 && statusMessage === 'Image is too large. Maximum size is 15 MB.'
}

const normalizeUrlSaveError = (error: unknown) => {
  if (isSizeError(error) || isExpectedUrlSaveError(error)) {
    throw error
  }

  throw publicUrlError()
}

const sizeError = () => createError({
  statusCode: 413,
  statusMessage: 'Image is too large. Maximum size is 15 MB.',
})

const isPrivateIpv4 = (address: string) => {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10))

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && parts[2] === 0) ||
    (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  )
}

const isPrivateIpv6 = (address: string) => {
  const value = address.toLowerCase()

  if (value.startsWith('::ffff:')) {
    return isPrivateIpv4(value.slice(7))
  }

  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe8') ||
    value.startsWith('fe9') ||
    value.startsWith('fea') ||
    value.startsWith('feb') ||
    value.startsWith('ff') ||
    value.startsWith('2001:db8')
  )
}

const isPublicIpAddress = (address: string) => {
  const version = isIP(address)

  if (version === 4) {
    return !isPrivateIpv4(address)
  }

  if (version === 6) {
    return !isPrivateIpv6(address)
  }

  return false
}

const parseRemoteUrl = (value: string) => {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw publicUrlError()
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw publicUrlError()
  }

  return url
}

const assertPublicRemoteTarget = async (url: URL) => {
  const hostname = url.hostname.toLowerCase()

  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw publicUrlError()
  }

  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw publicUrlError()
    }

    return
  }

  let addresses: Array<{ address: string }>

  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw publicUrlError()
  }

  if (!addresses.some(({ address }) => isPublicIpAddress(address))) {
    throw publicUrlError()
  }
}

const contentTypeMime = (contentType: string | null) => {
  return contentType?.split(';')[0]?.trim().toLowerCase() ?? ''
}

const readLimitedBody = async (response: Response) => {
  if (!response.body) {
    throw publicUrlError(502)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    if (!value) {
      continue
    }

    size += value.byteLength

    if (size > maxImageSizeBytes) {
      await reader.cancel().catch(() => {})
      throw sizeError()
    }

    chunks.push(value)
  }

  return Buffer.concat(chunks, size)
}

const fetchRemoteImage = async (sourceUrl: string): Promise<SaveImageInput> => {
  let currentUrl = parseRemoteUrl(sourceUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), remoteFetchTimeoutMs)

  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      await assertPublicRemoteTarget(currentUrl)

      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')

        if (!location || redirectCount === maxRedirects) {
          throw publicUrlError()
        }

        currentUrl = parseRemoteUrl(new URL(location, currentUrl).toString())
        continue
      }

      if (!response.ok) {
        throw publicUrlError(502)
      }

      await assertPublicRemoteTarget(currentUrl)

      const mimeType = contentTypeMime(response.headers.get('content-type'))

      if (!imageMimeTypes.includes(mimeType)) {
        throw publicUrlError()
      }

      const contentLength = response.headers.get('content-length')
      const declaredSize = contentLength ? Number.parseInt(contentLength, 10) : 0

      if (declaredSize > maxImageSizeBytes) {
        throw sizeError()
      }

      const data = await readLimitedBody(response)

      if (!data.length) {
        throw publicUrlError()
      }

      return {
        data,
        originalName: currentUrl.pathname.split('/').pop() || null,
        mimeType,
        sourceUrl,
      }
    }

    throw publicUrlError()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw publicUrlError(408)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

const readLocalImage = async (event: H3Event): Promise<SaveImageInput> => {
  const parts = await readMultipartFormData(event)
  const image = parts?.find(isImagePart)

  if (!image || !image.data.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported file type. Use JPEG, PNG, WebP, GIF, or AVIF.',
    })
  }

  if (image.data.length > maxImageSizeBytes) {
    throw sizeError()
  }

  return {
    data: image.data,
    originalName: image.filename ?? null,
    mimeType: image.type || 'application/octet-stream',
    sourceUrl: null,
  }
}

export default defineEventHandler(async (event) => {
  const contentType = getRequestHeader(event, 'content-type') ?? ''
  let input: SaveImageInput

  if (contentType.includes('application/json')) {
    const body = await readBody<{ url?: unknown }>(event)
    const url = typeof body.url === 'string' ? body.url.trim() : ''

    if (!url) {
      throw publicUrlError()
    }

    try {
      input = await fetchRemoteImage(url)
    } catch (error) {
      normalizeUrlSaveError(error)
    }
  } else {
    input = await readLocalImage(event)
  }

  const db = await ensureDataStore()
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const filename = `${id}${extensionFor(input.originalName ?? undefined, input.mimeType)}`
  const path = `${imageDir}/${filename}`

  await writeFile(path, input.data)

  try {
    db.prepare(`
      INSERT INTO images (id, filename, original_name, mime_type, size_bytes, created_at, source_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, filename, input.originalName, input.mimeType, input.data.length, createdAt, input.sourceUrl)
  } catch (error) {
    await unlink(path).catch(() => {})
    throw error
  }

  const row = db
    .prepare('SELECT * FROM images WHERE id = ?')
    .get(id) as ImageRow

  return toImageResponse(row)
})
