import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createError } from 'h3'

export const maxImageSizeBytes = 15 * 1024 * 1024
export const remoteFetchTimeoutMs = 5000
export const maxRedirects = 5
export const imageMimeTypes = ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']

export type SaveImageInput = {
  data: Buffer
  originalName: string | null
  mimeType: string
  sourceUrl: string | null
}

export const publicUrlError = (statusCode = 400) => createError({
  statusCode,
  statusMessage: 'This image URL cannot be saved.',
})

export const sizeError = () => createError({
  statusCode: 413,
  statusMessage: 'Image is too large. Maximum size is 15 MB.',
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

export const normalizeUrlSaveError = (error: unknown) => {
  if (isSizeError(error) || isExpectedUrlSaveError(error)) {
    throw error
  }

  throw publicUrlError()
}

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

export const isPublicIpAddress = (address: string) => {
  const version = isIP(address)

  if (version === 4) {
    return !isPrivateIpv4(address)
  }

  if (version === 6) {
    return !isPrivateIpv6(address)
  }

  return false
}

export const isPublicRemoteTarget = (hostname: string, addresses: Array<{ address: string }> = []) => {
  const normalizedHostname = hostname.toLowerCase()

  if (!normalizedHostname || normalizedHostname === 'localhost' || normalizedHostname.endsWith('.localhost')) {
    return false
  }

  if (isIP(normalizedHostname)) {
    return isPublicIpAddress(normalizedHostname)
  }

  return addresses.some(({ address }) => isPublicIpAddress(address))
}

export const parseRemoteUrl = (value: string) => {
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

export const assertPublicRemoteTarget = async (url: URL) => {
  const hostname = url.hostname.toLowerCase()

  if (isIP(hostname)) {
    if (!isPublicRemoteTarget(hostname)) {
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

  if (!isPublicRemoteTarget(hostname, addresses)) {
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

export const fetchRemoteImage = async (sourceUrl: string): Promise<SaveImageInput> => {
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
