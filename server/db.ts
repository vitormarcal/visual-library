import { createHash, randomUUID } from 'node:crypto'
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

export type ImageTagRow = {
  id: string
  name: string
  normalized_name: string
}

export type TagSummaryRow = ImageTagRow & {
  image_count: number
  last_used_at: string
  cover_image_id: string | null
}

export const maxTagsPerImage = 8
export const maxTagLength = 48

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
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL
      )
    `)
    db.exec(`
      CREATE TABLE IF NOT EXISTS image_tags (
        image_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (image_id, tag_id)
      )
    `)

    const columns = db.prepare('PRAGMA table_info(images)').all() as Array<{ name: string }>

    if (!columns.some((column) => column.name === 'source_url')) {
      db.exec('ALTER TABLE images ADD COLUMN source_url TEXT')
    }

    if (!columns.some((column) => column.name === 'content_hash')) {
      db.exec('ALTER TABLE images ADD COLUMN content_hash TEXT')
    }

    const tagColumns = db.prepare('PRAGMA table_info(tags)').all() as Array<{ name: string }>
    if (!tagColumns.some((column) => column.name === 'cover_image_id')) {
      db.exec('ALTER TABLE tags ADD COLUMN cover_image_id TEXT')
    }
    reconcileTagCovers()

    db.exec('DROP INDEX IF EXISTS images_content_hash_idx')
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS images_content_hash_unique_idx
      ON images(content_hash)
      WHERE content_hash IS NOT NULL
    `)
  }

  return db
}

export const normalizeTagName = (value: string) => {
  const name = value.trim().replace(/\s+/g, ' ')

  return {
    name,
    normalizedName: name.toLowerCase(),
  }
}

export const normalizeTagValues = (values: string[]) => {
  const cleanedTags = values
    .map((value) => normalizeTagName(value))
    .filter((tag) => tag.normalizedName.length > 0)

  const uniqueTags = cleanedTags.filter((tag, index) => {
    return cleanedTags.findIndex((candidate) => candidate.normalizedName === tag.normalizedName) === index
  })

  if (uniqueTags.length > maxTagsPerImage) {
    throw new Error('Too many tags')
  }

  if (uniqueTags.some((tag) => tag.name.length > maxTagLength)) {
    throw new Error('Tag is too long')
  }

  return uniqueTags
}

export const toTagResponse = (row: ImageTagRow) => ({
  id: row.id,
  name: row.name,
  normalizedName: row.normalized_name,
})

export const getImageTags = (imageId: string) => {
  const dbInstance = db

  if (!dbInstance) {
    return []
  }

  const rows = dbInstance.prepare(`
    SELECT tags.id, tags.name, tags.normalized_name
    FROM image_tags
    INNER JOIN tags ON tags.id = image_tags.tag_id
    WHERE image_tags.image_id = ?
    ORDER BY image_tags.created_at ASC, tags.name ASC
  `).all(imageId) as ImageTagRow[]

  return rows.map(toTagResponse)
}

export const listTagSummaries = () => {
  const dbInstance = db

  if (!dbInstance) {
    return []
  }

  const rows = dbInstance.prepare(`
    SELECT
      tags.id,
      tags.name,
      tags.normalized_name,
      tags.last_used_at,
      tags.cover_image_id,
      COUNT(image_tags.image_id) AS image_count
    FROM tags
    INNER JOIN image_tags ON image_tags.tag_id = tags.id
    GROUP BY tags.id
    ORDER BY tags.last_used_at DESC, image_count DESC, tags.name ASC
  `).all() as TagSummaryRow[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    imageCount: row.image_count,
    lastUsedAt: row.last_used_at,
    coverImageId: row.cover_image_id,
  }))
}

// Preserve a valid choice; reconcile only after association changes are complete.
export const reconcileTagCovers = (tagIds?: string[]) => {
  if (!db) return
  const rows = tagIds
    ? [...new Set(tagIds)].map((id) => db!.prepare('SELECT id, cover_image_id FROM tags WHERE id = ?').get(id)).filter(Boolean)
    : db.prepare('SELECT id, cover_image_id FROM tags').all()
  for (const row of rows as Array<{ id: string; cover_image_id: string | null }>) {
    if (row.cover_image_id && db.prepare(`SELECT 1 FROM image_tags
      INNER JOIN images ON images.id = image_tags.image_id
      WHERE tag_id = ? AND image_id = ?`).get(row.id, row.cover_image_id)) continue
    const candidate = db.prepare(`SELECT image_id FROM image_tags
      INNER JOIN images ON images.id = image_tags.image_id
      WHERE tag_id = ? ORDER BY image_tags.created_at ASC, images.created_at ASC, images.id ASC LIMIT 1`)
      .get(row.id) as { image_id: string } | undefined
    db.prepare('UPDATE tags SET cover_image_id = ? WHERE id = ?').run(candidate?.image_id ?? null, row.id)
  }
}

export const deleteImageRecord = (imageId: string) => {
  if (!db) throw new Error('Data store is not initialized')
  const affected = getImageTags(imageId).map((tag) => tag.id)
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(imageId)
    db.prepare('DELETE FROM images WHERE id = ?').run(imageId)
    reconcileTagCovers(affected)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export const replaceImageTags = (imageId: string, values: string[]) => {
  const dbInstance = db

  if (!dbInstance) {
    return []
  }

  const uniqueTags = normalizeTagValues(values)
  const now = new Date().toISOString()
  const affectedTags = new Set(getImageTags(imageId).map((tag) => tag.id))

  dbInstance.exec('BEGIN')

  try {
    dbInstance.prepare('DELETE FROM image_tags WHERE image_id = ?').run(imageId)

    for (const [index, tag] of uniqueTags.entries()) {
      const attachedAt = new Date(Date.parse(now) + index).toISOString()
      let row = dbInstance
        .prepare('SELECT id, name, normalized_name FROM tags WHERE normalized_name = ?')
        .get(tag.normalizedName) as ImageTagRow | undefined

      if (!row) {
        const id = randomUUID()
        dbInstance.prepare(`
          INSERT INTO tags (id, name, normalized_name, created_at, last_used_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, tag.name, tag.normalizedName, now, now)
        row = { id, name: tag.name, normalized_name: tag.normalizedName }
      } else {
        dbInstance.prepare('UPDATE tags SET last_used_at = ? WHERE id = ?').run(now, row.id)
      }

      dbInstance.prepare(`
        INSERT INTO image_tags (image_id, tag_id, created_at)
        VALUES (?, ?, ?)
      `).run(imageId, row.id, attachedAt)
      affectedTags.add(row.id)
    }

    reconcileTagCovers([...affectedTags])
    dbInstance.exec('COMMIT')
  } catch (error) {
    dbInstance.exec('ROLLBACK')
    throw error
  }

  return uniqueTags
    .map((tag) => dbInstance
      .prepare('SELECT id, name, normalized_name FROM tags WHERE normalized_name = ?')
      .get(tag.normalizedName) as ImageTagRow | undefined)
    .filter((tag): tag is ImageTagRow => Boolean(tag))
    .map(toTagResponse)
}

// One transaction keeps a group's additions all-or-nothing.
export const addTagsToImages = (imageIds: string[], values: string[]) => {
  if (!db) throw new Error('Data store is not initialized')
  const dbInstance = db
  const ids = [...new Set(imageIds)]
  const additions = normalizeTagValues(values)
  if (!ids.length || !additions.length) throw new Error('Select images and add tags')

  dbInstance.exec('BEGIN')
  try {
    const current = new Map(ids.map((id) => {
      if (!dbInstance.prepare('SELECT id FROM images WHERE id = ?').get(id)) {
        throw new Error('Image not found')
      }
      const tags = getImageTags(id)
      normalizeTagValues([...tags.map((tag) => tag.name), ...additions.map((tag) => tag.name)])
      return [id, tags] as const
    }))
    const now = new Date().toISOString()
    const affectedTags = new Set<string>()
    for (const [index, tag] of additions.entries()) {
      const missing = ids.filter((id) => !current.get(id)!.some((existing) => existing.normalizedName === tag.normalizedName))
      if (!missing.length) continue
      let row = dbInstance.prepare('SELECT id FROM tags WHERE normalized_name = ?').get(tag.normalizedName) as { id: string } | undefined
      if (!row) {
        row = { id: randomUUID() }
        dbInstance.prepare('INSERT INTO tags (id, name, normalized_name, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)')
          .run(row.id, tag.name, tag.normalizedName, now, now)
      } else {
        dbInstance.prepare('UPDATE tags SET last_used_at = ? WHERE id = ?').run(now, row.id)
      }
      for (const id of missing) {
        dbInstance.prepare('INSERT INTO image_tags (image_id, tag_id, created_at) VALUES (?, ?, ?)')
          .run(id, row.id, new Date(Date.parse(now) + index).toISOString())
      }
      affectedTags.add(row.id)
    }
    reconcileTagCovers([...affectedTags])
    const images = ids.map((id) => ({ id, tags: getImageTags(id) }))
    dbInstance.exec('COMMIT')
    return images
  } catch (error) {
    dbInstance.exec('ROLLBACK')
    throw error
  }
}

export const toImageResponse = (row: ImageRow, tags = getImageTags(row.id)) => ({
  id: row.id,
  filename: row.filename,
  originalName: row.original_name,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at,
  src: `/images/${encodeURIComponent(row.filename)}`,
  tags,
})
