import { readFile, realpath } from 'node:fs/promises'
import { basename, join, resolve, relative, isAbsolute } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseArgs } from 'node:util'
import { createSemanticEncoder } from './semantic-extract.mjs'
import { semanticFingerprint, digest } from './semantic-features.mjs'
const { values } = parseArgs({ options: { data: { type: 'string' } } })
if (!values.data) throw new Error('Missing data directory')
const data = resolve(values.data), images = await realpath(join(data, 'images'))
const db = new DatabaseSync(join(data, 'library.sqlite')); db.exec('PRAGMA busy_timeout=5000')
const encoder = await createSemanticEncoder(join(data, 'semantic/models'))
let textLoaded = false, chain = Promise.resolve(), stopping = false
const next = db.prepare(`SELECT i.id,i.filename,i.content_hash FROM images i
  LEFT JOIN image_semantic_vectors v ON v.image_id=i.id AND v.fingerprint=?
  WHERE i.hidden_from_gallery=0 AND (v.image_id IS NULL OR v.source_hash IS NOT i.content_hash)
  ORDER BY i.created_at,i.id LIMIT 1`)
const save = db.prepare(`INSERT INTO image_semantic_vectors (image_id,fingerprint,source_hash,status,vector_json)
  SELECT id,?,content_hash,?,? FROM images WHERE id=? AND content_hash IS ? AND hidden_from_gallery=0
  ON CONFLICT(image_id,fingerprint) DO UPDATE SET source_hash=excluded.source_hash,status=excluded.status,vector_json=excluded.vector_json`)
async function stop() {
  if (stopping) return
  stopping = true
  try { await encoder.dispose() } finally { db.close(); process.exit(0) }
}
function reply(value) { if (process.connected) process.send(value) }
async function execute(message) {
  try {
    if (message.type === 'prepare') {
      await encoder.dispose(); textLoaded = false
      let vision = false
      try {
        for (;;) {
          const row = next.get(semanticFingerprint)
          if (!row) break
          // Model load errors affect the job, not every image in the library.
          if (!vision) { await encoder.loadVision(); vision = true }
          let status = 'ready', vector = null
          try {
            if (basename(row.filename) !== row.filename) throw new Error('Invalid path')
            const file = await realpath(join(images, row.filename)), within = relative(images, file)
            if (within.startsWith('..') || isAbsolute(within)) throw new Error('Invalid path')
            const bytes = await readFile(file)
            if (!row.content_hash || digest(bytes) !== row.content_hash) throw new Error('Source changed')
            vector = JSON.stringify(await encoder.image(bytes))
          } catch { status = 'failed' }
          save.run(semanticFingerprint, status, vector, row.id, row.content_hash)
        }
      } finally { await encoder.disposeVision() }
      // Both towers/tokenizer are available before reporting initial preparation ready.
      await encoder.loadText(); textLoaded = true
      reply({ id: message.id, prepared: true })
    } else if (message.type === 'query' && typeof message.text === 'string' && message.text.length <= 500) {
      if (!textLoaded) { await encoder.loadText(); textLoaded = true }
      reply({ id: message.id, vector: await encoder.text(message.text) })
    } else reply({ id: message.id, error: 'invalid-request' })
  } catch {
    reply({ id: message.id, error: 'model-unavailable' })
    await encoder.dispose(); textLoaded = false
  }
}
process.on('message', message => { chain = chain.then(() => execute(message)).catch(() => stop()) })
process.on('disconnect', () => { void stop() })
process.on('SIGTERM', () => { void stop() })
