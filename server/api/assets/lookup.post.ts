import { createError, getRequestHeader, setHeader } from 'h3'
import { ensureDataStore } from '../../db.ts'
import { readLimitedRequest } from '../../image-upload.ts'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  if (!/^application\/json(?:\s*;|\s*$)/i.test(getRequestHeader(event, 'content-type') ?? '')) {
    throw createError({ statusCode: 415, statusMessage: 'Use application/json.' })
  }
  const bytes = await readLimitedRequest(event, 16 * 1024)
  const invalid = () => createError({ statusCode: 400, statusMessage: 'Provide 1–100 SHA-256 hashes.' })
  let body
  try { body = JSON.parse(bytes.toString('utf8')) } catch { throw invalid() }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => key !== 'hashes')
    || !Array.isArray(body.hashes) || body.hashes.length < 1 || body.hashes.length > 100
    || body.hashes.some((hash: unknown) => typeof hash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(hash))) throw invalid()
  const hashes: string[] = body.hashes.map((hash: string) => hash.toLowerCase())
  const unique = [...new Set(hashes)]
  const db = await ensureDataStore()
  const rows = db.prepare(`SELECT id, content_hash FROM images WHERE content_hash IN (${unique.map(() => '?').join(',')})`).all(...unique) as { id: string; content_hash: string }[]
  const matches = new Map(rows.map(row => [row.content_hash, row.id]))
  return {
    results: hashes.map(sha256 => {
      const id = matches.get(sha256)
      return { sha256, exists: id !== undefined, asset: id ? { id } : null }
    }),
  }
})
