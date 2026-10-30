import { readFile, realpath } from 'node:fs/promises'
import { basename, join, resolve, relative, isAbsolute } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseArgs } from 'node:util'
import { createDuplicateEncoder } from './duplicate-extract.mjs'
import { duplicateFingerprint, duplicateDigest } from './duplicate-features.mjs'
const { values } = parseArgs({ options: { data: { type: 'string' } } })
const data = resolve(values.data), images = await realpath(join(data, 'images'))
const db = new DatabaseSync(join(data, 'library.sqlite')); db.exec('PRAGMA busy_timeout=5000')
const next = db.prepare(`SELECT i.id,i.filename,i.content_hash FROM images i
  LEFT JOIN image_duplicate_vectors v ON v.image_id=i.id AND v.fingerprint=?
  WHERE i.hidden_from_gallery=0 AND (v.image_id IS NULL OR v.source_hash IS NOT i.content_hash)
  ORDER BY i.created_at,i.id LIMIT 1`)
const save = db.prepare(`INSERT INTO image_duplicate_vectors (image_id,fingerprint,source_hash,status,vector_json)
  SELECT id,?,content_hash,?,? FROM images WHERE id=? AND content_hash IS ? AND hidden_from_gallery=0
  ON CONFLICT(image_id) DO UPDATE SET fingerprint=excluded.fingerprint,source_hash=excluded.source_hash,status=excluded.status,vector_json=excluded.vector_json`)
let encoder
try {
  encoder = await createDuplicateEncoder(join(data, 'duplicates/models'))
  for (;;) {
    const row = next.get(duplicateFingerprint)
    if (!row) break
    let status = 'ready', vector = null
    try {
      if (basename(row.filename) !== row.filename) throw new Error('Invalid image path')
      const file = await realpath(join(images, row.filename)), within = relative(images, file)
      if (within.startsWith('..') || isAbsolute(within)) throw new Error('Invalid image path')
      const bytes = await readFile(file)
      if (!row.content_hash || duplicateDigest(bytes) !== row.content_hash) throw new Error('Source changed')
      vector = JSON.stringify(await encoder.image(bytes))
    } catch { status = 'failed' }
    save.run(duplicateFingerprint, status, vector, row.id, row.content_hash)
  }
} finally { await encoder?.dispose(); db.close() }
