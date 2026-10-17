import { createHash } from 'node:crypto'
import { readFile, realpath, mkdir } from 'node:fs/promises'
import { basename, join, resolve, relative, isAbsolute } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseArgs } from 'node:util'
import { descriptorVersion } from './features.mjs'
import { extractDescriptor, disposeExtractor, ModelUnavailableError } from './extract.mjs'

const { values } = parseArgs({ options: { data: { type: 'string' }, reference: { type: 'string', default: '' } } })
if (!values.data) throw new Error('Missing data directory')
const dataDir = resolve(values.data), imageDir = await realpath(join(dataDir, 'images'))
const cacheDir = join(dataDir, 'similarity', 'models')
await mkdir(cacheDir, { recursive: true })
const db = new DatabaseSync(join(dataDir, 'library.sqlite'))
db.exec('PRAGMA busy_timeout = 5000')
let priority = values.reference
process.on('message', message => { if (typeof message?.reference === 'string') priority = message.reference })
process.on('disconnect', () => process.exit(process.exitCode ?? 0))
const nextImage = db.prepare(`SELECT i.id, i.filename, i.content_hash FROM images i
  LEFT JOIN image_visual_features d ON d.image_id = i.id
  WHERE i.hidden_from_gallery = 0 AND (d.image_id IS NULL OR d.version != ? OR d.source_hash IS NOT i.content_hash)
  ORDER BY CASE WHEN i.id = ? THEN 0 ELSE 1 END, i.created_at DESC, i.id LIMIT 1`)
const save = db.prepare(`INSERT INTO image_visual_features (image_id, version, source_hash, status, features_json)
  SELECT id, ?, content_hash, ?, ? FROM images WHERE id = ? AND content_hash IS ? AND hidden_from_gallery = 0
  ON CONFLICT(image_id) DO UPDATE SET version = excluded.version, source_hash = excluded.source_hash,
  status = excluded.status, features_json = excluded.features_json`)
try {
  for (;;) {
    const row = nextImage.get(descriptorVersion, priority)
    if (!row) break
    let status = 'ready', features = null
    try {
      if (basename(row.filename) !== row.filename) throw new Error('Invalid filename')
      const file = await realpath(join(imageDir, row.filename))
      const within = relative(imageDir, file)
      if (within.startsWith('..') || isAbsolute(within)) throw new Error('Invalid path')
      const bytes = await readFile(file)
      if (row.content_hash && createHash('sha256').update(bytes).digest('hex') !== row.content_hash) throw new Error('Image bytes changed')
      features = JSON.stringify(await extractDescriptor(bytes, cacheDir))
    } catch (error) {
      if (error instanceof ModelUnavailableError) {
        process.send?.({ error: 'model-unavailable' })
        process.exitCode = 1
        break
      }
      status = 'failed'
    }
    save.run(descriptorVersion, status, features, row.id, row.content_hash)
    if (priority === row.id) priority = ''
    process.send?.({ prepared: row.id, status })
  }
} finally { await disposeExtractor(); db.close(); process.disconnect?.() }
