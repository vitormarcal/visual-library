import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import { appendResponseHeader, getRequestHeader, getResponseHeader, getResponseStatus, setHeader, type H3Event } from 'h3'

const compress = promisify(gzip)
export async function compressLibraryJson(event: H3Event, response: { body?: unknown }) {
  const path = event.path.split('?')[0]!
  // Only owner catalog responses: never credentials, public tokens, errors or files.
  if (event.method !== 'GET' || event.context.accessIdentity !== 'owner' || getResponseStatus(event) !== 200
    || !(path.startsWith('/api/library/') || path === '/api/images' || path === '/api/tags')
    || getResponseHeader(event, 'Content-Encoding') || !response.body || typeof response.body !== 'object'
    || Buffer.isBuffer(response.body)) return
  appendResponseHeader(event, 'Vary', 'Accept-Encoding')
  const encodings = (getRequestHeader(event, 'accept-encoding') ?? '').toLowerCase().split(',').map(entry => {
    const [name, ...parameters] = entry.trim().split(';')
    const quality = parameters.map(p => p.trim()).find(p => p.startsWith('q='))?.slice(2)
    return { name, quality: quality === undefined ? 1 : Number(quality) }
  })
  const accepted = encodings.find(e => e.name === 'gzip') ?? encodings.find(e => e.name === '*')
  if (!accepted || !(accepted.quality > 0 && accepted.quality <= 1)) return
  const json = Buffer.from(JSON.stringify(response.body))
  if (json.length < 1024) return
  const bytes = await compress(json)
  if (bytes.length >= json.length) return
  response.body = bytes
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Content-Encoding', 'gzip')
  setHeader(event, 'Content-Length', bytes.length)
}
