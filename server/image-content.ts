import { open } from 'node:fs/promises'
import { createError, getRequestHeader, sendStream, setHeader, setResponseStatus, type H3Event } from 'h3'
import { ensureDataStore, imageDir, type ImageRow } from './db.ts'
import { detectImageFormat } from './image-format.ts'

export const sendImageContent = async (event: H3Event, row: ImageRow) => {
  let file
  try { file = await open(`${imageDir}/${row.filename}`, 'r') }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    throw createError({ statusCode: code === 'ENOENT' || code === 'ENOTDIR' ? 404 : 500, statusMessage: 'Image file unavailable.' })
  }
  let streaming = false
  try {
    const stat = await file.stat()
    if (!stat.isFile()) throw createError({ statusCode: 404, statusMessage: 'Image file not found.' })
    // Legacy MIME came from the client. Sniff only a bounded prefix on delivery.
    const prefix = Buffer.alloc(Math.min(stat.size, 64 * 1024))
    let read = 0
    while (read < prefix.length) {
      const { bytesRead } = await file.read(prefix, read, prefix.length - read, read)
      if (!bytesRead) break
      read += bytesRead
    }
    const mime = detectImageFormat(prefix.subarray(0, read)).mimeType
    if (mime !== row.mime_type) {
      const db = await ensureDataStore()
      db.prepare('UPDATE images SET mime_type = ? WHERE id = ?').run(mime, row.id)
    }
    const etag = `W/"${row.id}-${stat.size}-${stat.mtimeMs}"`
    setHeader(event, 'Content-Type', mime)
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Cache-Control', 'private, max-age=3600')
    setHeader(event, 'ETag', etag)
    setHeader(event, 'Last-Modified', stat.mtime.toUTCString())
    const match = getRequestHeader(event, 'if-none-match')
    const since = getRequestHeader(event, 'if-modified-since')
    const unchanged = match !== undefined
      ? match === '*' || match.split(',').some(value => value.trim().replace(/^W\//, '') === etag.replace(/^W\//, ''))
      : since !== undefined && Math.floor(stat.mtimeMs / 1000) <= Math.floor(Date.parse(since) / 1000)
    if (unchanged) { setResponseStatus(event, 304); return '' }
    setHeader(event, 'Content-Length', stat.size)
    const stream = file.createReadStream({ start: 0, autoClose: true })
    // sendStream in H3 does not close a node stream when the client disconnects.
    const cancel = () => { if (!event.node.res.writableEnded) stream.destroy(new Error('Image request closed')) }
    event.node.res.once('close', cancel)
    stream.once('close', () => event.node.res.off('close', cancel))
    streaming = true
    return await sendStream(event, stream)
  } catch (error) {
    // A partial image cannot be replaced by a JSON error response.
    if (streaming && event.node.res.headersSent) {
      event.node.res.destroy(error instanceof Error ? error : new Error('Image stream failed'))
      return
    }
    // Before headers are sent, discard file-specific headers so H3 can send JSON.
    event.node.res.removeHeader('Content-Length')
    event.node.res.removeHeader('Content-Type')
    event.node.res.removeHeader('ETag')
    event.node.res.removeHeader('Last-Modified')
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Could not read image.' })
  } finally { if (!streaming) await file.close() }
}
