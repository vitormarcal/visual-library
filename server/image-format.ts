import { createError } from 'h3'

export type ImageFormat = { mimeType: string; extension: string }
const formats = {
  png: { mimeType: 'image/png', extension: '.png' },
  jpeg: { mimeType: 'image/jpeg', extension: '.jpg' },
  gif: { mimeType: 'image/gif', extension: '.gif' },
  webp: { mimeType: 'image/webp', extension: '.webp' },
  avif: { mimeType: 'image/avif', extension: '.avif' },
}
const invalid = () => createError({ statusCode: 415, statusMessage: 'Unsupported or invalid image. Use JPEG, PNG, WebP, GIF, or AVIF.' })

// Header detection is also used for legacy files without buffering the original.
export const detectImageFormat = (b: Buffer): ImageFormat => {
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && b.toString('ascii', 12, 16) === 'IHDR') return formats.png
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return formats.jpeg
  if (b.length >= 13 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))) return formats.gif
  if (b.length >= 20 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return formats.webp
  if (b.length >= 24 && b.toString('ascii', 4, 8) === 'ftyp') {
    const size = b.readUInt32BE(0)
    if (size >= 24 && size <= b.length && size % 4 === 0) {
      const brands = [b.toString('ascii', 8, 12)]
      for (let i = 16; i < size; i += 4) brands.push(b.toString('ascii', i, i + 4))
      if (brands.includes('avif') || brands.includes('avis')) return formats.avif
    }
  }
  throw invalid()
}

// Some JPEGs carry SEF metadata after EOI. Validate that directory rather than
// accepting arbitrary appended bytes; storage and hashing keep the full original.
const validJpegEnd = (b: Buffer, imageEnd: number): boolean => {
  if (imageEnd === b.length) return true
  if (b.length - imageEnd < 32 || b.toString('latin1', b.length - 4) !== 'SEFT') return false
  const directorySize = b.readUInt32LE(b.length - 8)
  const directory = b.length - 8 - directorySize
  if (directorySize < 24 || directory < imageEnd || b.toString('latin1', directory, directory + 4) !== 'SEFH') return false
  const count = b.readUInt32LE(directory + 8)
  if (!count || directorySize !== 12 + count * 12) return false
  const records: { start: number; end: number }[] = []
  for (let i = 0; i < count; i++) {
    const entry = directory + 12 + i * 12
    const start = directory - b.readUInt32LE(entry + 4), size = b.readUInt32LE(entry + 8)
    if (size < 8 || start < imageEnd || start + size > directory) return false
    if (b.readUInt32LE(start) !== b.readUInt32LE(entry)) return false
    const nameSize = b.readUInt32LE(start + 4)
    if (!nameSize || nameSize > size - 8) return false
    records.push({ start, end: start + size })
  }
  records.sort((a, c) => a.start - c.start)
  let end = imageEnd
  for (const record of records) {
    if (record.start !== end) return false
    end = record.end
  }
  return end === directory
}

export const validateImageFormat = (b: Buffer): ImageFormat => {
  const format = detectImageFormat(b)
  let valid = false
  if (format === formats.png) {
    let offset = 8, header = false, data = false, end = false
    while (offset + 12 <= b.length) {
      const size = b.readUInt32BE(offset), type = b.toString('ascii', offset + 4, offset + 8)
      if (offset + size + 12 > b.length) break
      if (offset === 8) header = type === 'IHDR' && size === 13 && b.readUInt32BE(offset + 8) > 0 && b.readUInt32BE(offset + 12) > 0
      if (type === 'IDAT' && size > 0) data = true
      offset += size + 12
      if (type === 'IEND') { end = size === 0 && offset === b.length; break }
    }
    valid = header && data && end
  } else if (format === formats.jpeg) {
    let offset = 2, frame = false, scan = false, end = false
    while (offset < b.length) {
      if (b[offset++] !== 255) break
      while (offset < b.length && b[offset] === 255) offset++
      const marker = b[offset++]
      if (marker === 217) { end = validJpegEnd(b, offset); break }
      if (marker === 0 || marker === undefined || marker === 216) break
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue
      if (offset + 2 > b.length) break
      const size = b.readUInt16BE(offset)
      if (size < 2 || offset + size > b.length) break
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        frame = size >= 8 && b.readUInt16BE(offset + 3) > 0 && b.readUInt16BE(offset + 5) > 0
      }
      offset += size
      if (marker === 218) {
        if (size < 6) break
        scan = true
        // Skip entropy bytes, stuffed FF and restart markers; support multiple scans.
        while (offset < b.length) {
          if (b[offset] !== 255) { offset++; continue }
          const next = b[offset + 1]
          if (next === 0 || (next >= 208 && next <= 215)) { offset += 2; continue }
          break
        }
      }
    }
    valid = frame && scan && end
  } else if (format === formats.gif) {
    let offset = 13, image = false, end = false
    if (b[10]! & 128) offset += 3 * (1 << ((b[10]! & 7) + 1))
    const blocks = () => {
      while (offset < b.length) {
        const size = b[offset++]!
        if (!size) return true
        offset += size
        if (offset > b.length) return false
      }
      return false
    }
    while (offset < b.length) {
      const marker = b[offset++]
      if (marker === 59) { end = offset === b.length; break }
      if (marker === 33) { offset++; if (!blocks()) break }
      else if (marker === 44) {
        if (offset + 9 > b.length || !b.readUInt16LE(offset + 4) || !b.readUInt16LE(offset + 6)) break
        const packed = b[offset + 8]!
        offset += 9
        if (packed & 128) offset += 3 * (1 << ((packed & 7) + 1))
        if (offset >= b.length || b[offset]! < 2 || b[offset]! > 8) break
        offset++
        if (!blocks()) break
        image = true
      } else break
    }
    valid = b.readUInt16LE(6) > 0 && b.readUInt16LE(8) > 0 && image && end
  } else if (format === formats.webp) {
    const chunks = (start: number, end: number, animated: boolean): boolean => {
      let offset = start, image = false
      while (offset + 8 <= end) {
        const type = b.toString('ascii', offset, offset + 4), size = b.readUInt32LE(offset + 4)
        if (offset + 8 + size > end) return false
        if ((type === 'VP8 ' && size >= 10 && b.subarray(offset + 11, offset + 14).equals(Buffer.from([157, 1, 42])))
          || (type === 'VP8L' && size >= 5 && b[offset + 8] === 47)) image = true
        if (type === 'ANMF' && animated && size > 16 && chunks(offset + 24, offset + 8 + size, false)) image = true
        offset += 8 + size + (size % 2)
      }
      return offset === end && image
    }
    valid = b.readUInt32LE(4) + 8 === b.length && chunks(12, b.length, true)
  } else {
    let offset = 0, metadata = false, data = false
    while (offset + 8 <= b.length) {
      let size = b.readUInt32BE(offset), header = 8
      const type = b.toString('ascii', offset + 4, offset + 8)
      if (size === 1) {
        if (offset + 16 > b.length) break
        const extended = b.readBigUInt64BE(offset + 8)
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) break
        size = Number(extended); header = 16
      } else if (size === 0) size = b.length - offset
      if (size < header || offset + size > b.length) break
      if ((type === 'meta' || type === 'moov') && size > header + 4) metadata = true
      if (type === 'mdat' && size > header) data = true
      offset += size
    }
    valid = offset === b.length && metadata && data
  }
  if (!valid) throw invalid()
  return format
}
