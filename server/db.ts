import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type ImageRow = {
  id: string
  filename: string
  original_name: string | null
  mime_type: string
  size_bytes: number
  created_at: string
  source_url: string | null
  content_hash: string | null
}

const dataDir = join(process.cwd(), 'data')
export const imageDir = join(dataDir, 'images')
const dbPath = join(dataDir, 'library.sqlite')

let db: DatabaseSync | undefined

export const hashImageBytes = (data: Buffer) => {
  return createHash('sha256').update(data).digest('hex')
}

export const ensureDataStore = async () => {
  await mkdir(imageDir, { recursive: true })

  if (!db) {
    db = new DatabaseSync(dbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        source_url TEXT,
        content_hash TEXT
      )
    `)

    const columns = db.prepare('PRAGMA table_info(images)').all() as Array<{ name: string }>

    if (!columns.some((column) => column.name === 'source_url')) {
      db.exec('ALTER TABLE images ADD COLUMN source_url TEXT')
    }

    if (!columns.some((column) => column.name === 'content_hash')) {
      db.exec('ALTER TABLE images ADD COLUMN content_hash TEXT')
    }

    db.exec('DROP INDEX IF EXISTS images_content_hash_idx')
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS images_content_hash_unique_idx
      ON images(content_hash)
      WHERE content_hash IS NOT NULL
    `)
  }

  return db
}

export const toImageResponse = (row: ImageRow) => ({
  id: row.id,
  filename: row.filename,
  originalName: row.original_name,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at,
  src: `/images/${encodeURIComponent(row.filename)}`,
})
