import { open } from 'node:fs/promises'
import { imageMeta } from 'image-meta'
import { ensureDataStore, imageDir, type ImageRow } from './db.ts'

export const readImageDimensions = (bytes: Uint8Array) => {
  try {
    const meta = imageMeta(bytes)
    let { width, height } = meta
    if (width && height && Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0) {
      // The browser displays JPEGs according to EXIF orientation.
      if (meta.orientation && meta.orientation >= 5 && meta.orientation <= 8) [width, height] = [height, width]
      return { width, height }
    }
  } catch { /* Missing metadata must not prevent saving or browsing an image. */ }
  return { width: null, height: null }
}

export const ensureImageDimensions = async (rows: ImageRow[]) => {
  const pending = rows.filter(row => !row.dimensions_checked)
  if (!pending.length) return
  const db = await ensureDataStore()
  const update = db.prepare('UPDATE images SET width = ?, height = ?, dimensions_checked = 1 WHERE id = ?')
  // One-time legacy backfill: bounded reads, eight files at a time, no full originals.
  for (let offset = 0; offset < pending.length; offset += 8) {
    await Promise.all(pending.slice(offset, offset + 8).map(async row => {
      let file
      try {
        file = await open(`${imageDir}/${row.filename}`, 'r')
        const prefix = Buffer.alloc(64 * 1024)
        let read = 0
        while (read < prefix.length) {
          const { bytesRead } = await file.read(prefix, read, prefix.length - read, read)
          if (!bytesRead) break
          read += bytesRead
        }
        const dimensions = readImageDimensions(prefix.subarray(0, read))
        update.run(dimensions.width, dimensions.height, row.id)
        Object.assign(row, dimensions, { dimensions_checked: 1 })
      } catch { /* Retry unreadable legacy files on a later request. */ }
      finally { await file?.close() }
    }))
  }
}
