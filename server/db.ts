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
  source: string
  hidden_from_gallery: number
  width: number | null
  height: number | null
  dimensions_checked: number
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
    db.exec('PRAGMA busy_timeout = 5000')
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

    db.exec(`
      CREATE TABLE IF NOT EXISTS asset_references (
        asset_id TEXT NOT NULL,
        application TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        url TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (asset_id, application, entity_type, entity_id)
      )
    `)

    db.exec(`CREATE TABLE IF NOT EXISTS owner_sessions (
      token_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, password_fingerprint TEXT NOT NULL
    ); CREATE TABLE IF NOT EXISTS owner_credentials (
      id INTEGER PRIMARY KEY CHECK(id = 1), password_hash TEXT, setup_generation TEXT
    ); CREATE TABLE IF NOT EXISTS owner_reset_commands (
      key_hash TEXT PRIMARY KEY, applied_at TEXT NOT NULL
    ); CREATE TABLE IF NOT EXISTS application_tokens (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT
    ); CREATE TABLE IF NOT EXISTS image_public_links (
      image_id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    );`)

    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='integration_credentials'").get()) {
      db.exec('BEGIN')
      try {
        db.exec(`INSERT OR IGNORE INTO application_tokens (id,name,token_hash,prefix,created_at,revoked_at)
          SELECT 'legacy-media-pulse',name,token_hash,prefix,created_at,revoked_at FROM integration_credentials;
          DROP TABLE integration_credentials;`)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
    }

    db.exec(`CREATE TABLE IF NOT EXISTS image_visual_features (
      image_id TEXT PRIMARY KEY, version TEXT NOT NULL, source_hash TEXT,
      status TEXT NOT NULL CHECK(status IN ('ready', 'failed')), features_json TEXT
    )`)
    db.exec(`CREATE TABLE IF NOT EXISTS image_semantic_vectors (
      image_id TEXT NOT NULL, fingerprint TEXT NOT NULL, source_hash TEXT,
      status TEXT NOT NULL CHECK(status IN ('ready', 'failed')), vector_json TEXT,
      PRIMARY KEY (image_id, fingerprint)
    )`)
    const columns = db.prepare('PRAGMA table_info(images)').all() as Array<{ name: string }>

    if (!columns.some((column) => column.name === 'source_url')) {
      db.exec('ALTER TABLE images ADD COLUMN source_url TEXT')
    }

    if (!columns.some((column) => column.name === 'content_hash')) {
      db.exec('ALTER TABLE images ADD COLUMN content_hash TEXT')
    }

    db.exec('BEGIN')
    try {
      if (!columns.some(column => column.name === 'width')) db.exec('ALTER TABLE images ADD COLUMN width INTEGER')
      if (!columns.some(column => column.name === 'height')) db.exec('ALTER TABLE images ADD COLUMN height INTEGER')
      if (!columns.some(column => column.name === 'dimensions_checked')) db.exec('ALTER TABLE images ADD COLUMN dimensions_checked INTEGER NOT NULL DEFAULT 0')
      if (!columns.some((column) => column.name === 'source')) db.exec("ALTER TABLE images ADD COLUMN source TEXT NOT NULL DEFAULT 'visual-library'")
      if (!columns.some((column) => column.name === 'hidden_from_gallery')) db.exec('ALTER TABLE images ADD COLUMN hidden_from_gallery INTEGER NOT NULL DEFAULT 0 CHECK (hidden_from_gallery IN (0, 1))')
      const imageTagColumns = db.prepare('PRAGMA table_info(image_tags)').all() as Array<{ name: string }>
      if (!imageTagColumns.some(column => column.name === 'personal')) {
        db.exec('ALTER TABLE image_tags ADD COLUMN personal INTEGER NOT NULL DEFAULT 1 CHECK (personal IN (0, 1))')
      }
      db.exec(`CREATE TABLE IF NOT EXISTS asset_reference_tag_groups (
        asset_id TEXT NOT NULL, application TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        group_name TEXT NOT NULL, tags_json TEXT NOT NULL, revision INTEGER NOT NULL,
        PRIMARY KEY (asset_id, application, entity_type, entity_id, group_name)
      )`)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); db.close(); db = undefined; throw error }

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
    INNER JOIN images ON images.id = image_tags.image_id AND images.hidden_from_gallery = 0
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

export const findTag = (id: string) => {
  if (!db) return null
  const row = db.prepare(`SELECT tags.id, tags.name, tags.normalized_name,
    COUNT(images.id) AS image_count FROM tags
    LEFT JOIN image_tags ON image_tags.tag_id = tags.id
    LEFT JOIN images ON images.id = image_tags.image_id AND images.hidden_from_gallery = 0 WHERE tags.id = ? GROUP BY tags.id`)
    .get(id) as (ImageTagRow & { image_count: number }) | undefined
  return row ? { ...toTagResponse(row), imageCount: row.image_count } : null
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
      WHERE tag_id = ? AND image_id = ? AND images.hidden_from_gallery = 0`).get(row.id, row.cover_image_id)) continue
    const candidate = db.prepare(`SELECT image_id FROM image_tags
      INNER JOIN images ON images.id = image_tags.image_id
      WHERE tag_id = ? AND images.hidden_from_gallery = 0 ORDER BY image_tags.created_at ASC, images.created_at ASC, images.id ASC LIMIT 1`)
      .get(row.id) as { image_id: string } | undefined
    db.prepare('UPDATE tags SET cover_image_id = ? WHERE id = ?').run(candidate?.image_id ?? null, row.id)
  }
}

export const deleteImageRecord = (imageId: string) => {
  if (!db) throw new Error('Data store is not initialized')
  const affected = getImageTags(imageId).map((tag) => tag.id)
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM image_public_links WHERE image_id = ?').run(imageId)
    db.prepare('DELETE FROM image_semantic_vectors WHERE image_id = ?').run(imageId)
    db.prepare('DELETE FROM image_visual_features WHERE image_id = ?').run(imageId)
    db.prepare('DELETE FROM asset_reference_tag_groups WHERE asset_id = ?').run(imageId)
    db.prepare('DELETE FROM asset_references WHERE asset_id = ?').run(imageId)
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
  const personalFlags = new Map((dbInstance.prepare('SELECT tag_id, personal FROM image_tags WHERE image_id = ?')
    .all(imageId) as Array<{ tag_id: string; personal: number }>).map(row => [row.tag_id, row.personal]))
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
        INSERT INTO image_tags (image_id, tag_id, created_at, personal)
        VALUES (?, ?, ?, ?)
      `).run(imageId, row.id, attachedAt, personalFlags.get(row.id) ?? 1)
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

// Caller owns the transaction, so upload and bulk tagging can share atomic additions.
export const addImageTagsWithinTransaction = (imageIds: string[], additions: ReturnType<typeof normalizeTagValues>, personal = true) => {
  if (!db) throw new Error('Data store is not initialized')
  const dbInstance = db
  const ids = [...new Set(imageIds)]
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
    if (personal) for (const id of ids) dbInstance.prepare(`UPDATE image_tags SET personal = 1
      WHERE image_id = ? AND tag_id IN (SELECT id FROM tags WHERE normalized_name = ?)`)
      .run(id, tag.normalizedName)
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
      dbInstance.prepare('INSERT INTO image_tags (image_id, tag_id, created_at, personal) VALUES (?, ?, ?, ?)')
        .run(id, row.id, new Date(Date.parse(now) + index).toISOString(), Number(personal))
    }
    affectedTags.add(row.id)
  }
  reconcileTagCovers([...affectedTags])
  return ids.map((id) => ({ id, tags: getImageTags(id) }))
}

// One transaction keeps a group's additions all-or-nothing.
export const addTagsToImages = (imageIds: string[], values: string[]) => {
  if (!db) throw new Error('Data store is not initialized')
  const additions = normalizeTagValues(values)
  if (!imageIds.length || !additions.length) throw new Error('Select images and add tags')
  db.exec('BEGIN')
  try {
    const images = addImageTagsWithinTransaction(imageIds, additions)
    db.exec('COMMIT')
    return images
  } catch (error) { db.exec('ROLLBACK'); throw error }
}

export type SourceReference = { entityType: string; entityId: string; url?: string }
export type ManagedTagGroup = { tags: string[]; revision: number }
export type AssetEnrichment = { tags: string[]; sourceReference?: SourceReference; managedTags?: Record<string, ManagedTagGroup> }
export class ManagedTagConflict extends Error {
  code: string
  constructor(message: string, code: string) { super(message); this.code = code }
}

export const getAssetReferences = (assetId: string) => {
  if (!db) return []
  const rows = db.prepare(`SELECT application, entity_type, entity_id, url, created_at
    FROM asset_references WHERE asset_id = ? ORDER BY created_at, application, entity_type, entity_id`).all(assetId) as Array<{
      application: string; entity_type: string; entity_id: string; url: string | null; created_at: string
    }>
  return rows.map(row => ({ application: row.application, entityType: row.entity_type,
    entityId: row.entity_id, url: row.url, createdAt: row.created_at,
    managedTags: Object.fromEntries((db!.prepare(`SELECT group_name, tags_json, revision FROM asset_reference_tag_groups
      WHERE asset_id = ? AND application = ? AND entity_type = ? AND entity_id = ?`).all(assetId, row.application, row.entity_type, row.entity_id) as
      Array<{ group_name: string; tags_json: string; revision: number }>).map(group =>
      [group.group_name, { tags: JSON.parse(group.tags_json), revision: group.revision }])) }))
}

export const enrichImageWithinTransaction = (assetId: string, application: string, enrichment?: AssetEnrichment) => {
  if (!db) throw new Error('Data store is not initialized')
  if (!enrichment) return
  const reference = enrichment.sourceReference
  const exists = reference && db.prepare(`SELECT 1 FROM asset_references
    WHERE asset_id = ? AND application = ? AND entity_type = ? AND entity_id = ?`)
    .get(assetId, application, reference.entityType, reference.entityId)
  if (!exists) {
    const tags = normalizeTagValues(enrichment.tags)
    addImageTagsWithinTransaction([assetId], tags)
    if (reference) db.prepare(`INSERT INTO asset_references
      (asset_id, application, entity_type, entity_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(assetId, application, reference.entityType, reference.entityId, reference.url ?? null, new Date().toISOString())
  }
  if (reference) for (const [group, value] of Object.entries(enrichment.managedTags ?? {})) {
    replaceReferenceTagGroupWithinTransaction(assetId, application, reference, group, value)
  }
}

// Increment when thumbnail dimensions, encoder or quality change.
export const thumbnailVersion = 'v1'

export const toImageResponse = (row: ImageRow, tags = getImageTags(row.id)) => ({
  id: row.id,
  filename: row.filename,
  originalName: row.original_name,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at,
  src: `/images/${encodeURIComponent(row.filename)}`,
  thumbnailSrc: row.content_hash ? `/thumbnails/${encodeURIComponent(row.id)}?v=${thumbnailVersion}&hash=${row.content_hash}` : null,
  width: row.width ?? null,
  height: row.height ?? null,
  tags,
  source: row.source,
  hiddenFromGallery: Boolean(row.hidden_from_gallery),
})

export const toAssetResponse = (row: ImageRow) => ({
  id: row.id, mimeType: row.mime_type, sizeBytes: row.size_bytes,
  createdAt: row.created_at, source: row.source, hiddenFromGallery: Boolean(row.hidden_from_gallery),
  tags: getImageTags(row.id), sourceReferences: getAssetReferences(row.id),
})

export const setImageVisibility = (id: string, hidden: boolean) => {
  if (!db) throw new Error('Data store is not initialized')
  if (!db.prepare('SELECT id FROM images WHERE id = ?').get(id)) return null
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE images SET hidden_from_gallery = ? WHERE id = ?').run(Number(hidden), id)
    reconcileTagCovers(getImageTags(id).map(tag => tag.id))
    const row = db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow
    db.exec('COMMIT')
    return row
  } catch (error) { db.exec('ROLLBACK'); throw error }
}

// The caller owns the transaction; tags and the reference revision commit together.
const replaceReferenceTagGroupWithinTransaction = (
  assetId: string, application: string, reference: SourceReference, group: string, value: ManagedTagGroup,
) => {
  if (!db) throw new Error('Data store is not initialized')
  let additions: ReturnType<typeof normalizeTagValues>
  try { additions = normalizeTagValues(value.tags) }
  catch (error) { throw new ManagedTagConflict((error as Error).message, 'TAG_LIMIT') }
  const key = [assetId, application, reference.entityType, reference.entityId, group]
  const previous = db.prepare(`SELECT tags_json, revision FROM asset_reference_tag_groups
    WHERE asset_id = ? AND application = ? AND entity_type = ? AND entity_id = ? AND group_name = ?`).get(...key) as
    { tags_json: string; revision: number } | undefined
  const oldNames = new Set<string>(previous ? JSON.parse(previous.tags_json).map((tag: string) => normalizeTagName(tag).normalizedName) : [])
  const names = new Set(additions.map(tag => tag.normalizedName))
  if (previous && value.revision < previous.revision) throw new ManagedTagConflict('Stale classification revision.', 'STALE_REVISION')
  if (previous && value.revision === previous.revision) {
    if (oldNames.size !== names.size || [...names].some(name => !oldNames.has(name))) {
      throw new ManagedTagConflict('Classification revision already has different tags.', 'REVISION_CONFLICT')
    }
    return { preservedTags: [] as string[], legacyTagsPreserved: false }
  }
  const current = db.prepare(`SELECT t.id, t.name, t.normalized_name, it.personal FROM image_tags it
    JOIN tags t ON t.id = it.tag_id WHERE it.image_id = ?`).all(assetId) as
    Array<ImageTagRow & { personal: number }>
  const other = db.prepare(`SELECT tags_json FROM asset_reference_tag_groups WHERE asset_id = ?
    AND NOT (application = ? AND entity_type = ? AND entity_id = ? AND group_name = ?)`).all(...key) as Array<{ tags_json: string }>
  const otherNames = new Set<string>(other.flatMap(row => JSON.parse(row.tags_json).map((tag: string) => normalizeTagName(tag).normalizedName)))
  const removable = current.filter(tag => oldNames.has(tag.normalized_name) && !names.has(tag.normalized_name) && !tag.personal && !otherNames.has(tag.normalized_name))
  const removed = new Set(removable.map(tag => tag.id))
  // An unchanged absent term was removed manually; do not restore it on the next correction.
  const newTags = additions.filter(tag => !oldNames.has(tag.normalizedName))
  try { normalizeTagValues([...current.filter(tag => !removed.has(tag.id)).map(tag => tag.name), ...newTags.map(tag => tag.name)]) }
  catch (error) { throw new ManagedTagConflict((error as Error).message, 'TAG_LIMIT') }
  for (const tag of removable) db.prepare('DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?').run(assetId, tag.id)
  addImageTagsWithinTransaction([assetId], newTags, false)
  db.prepare(`INSERT INTO asset_reference_tag_groups (asset_id, application, entity_type, entity_id, group_name, tags_json, revision)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(asset_id, application, entity_type, entity_id, group_name)
    DO UPDATE SET tags_json = excluded.tags_json, revision = excluded.revision`)
    .run(...key, JSON.stringify(additions.map(tag => tag.name)), value.revision)
  reconcileTagCovers(removable.map(tag => tag.id))
  return {
    preservedTags: current.filter(tag => oldNames.has(tag.normalized_name) && !names.has(tag.normalized_name) && !removed.has(tag.id)).map(tag => tag.name),
    legacyTagsPreserved: !previous && current.length > 0,
  }
}

export const replaceAssetReferenceTagGroup = (
  assetId: string, application: string, reference: SourceReference, group: string, value: ManagedTagGroup,
) => {
  if (!db) throw new Error('Data store is not initialized')
  if (!db.prepare('SELECT 1 FROM images WHERE id = ?').get(assetId) || !db.prepare(`SELECT 1 FROM asset_references
    WHERE asset_id = ? AND application = ? AND entity_type = ? AND entity_id = ?`).get(assetId, application, reference.entityType, reference.entityId)) return null
  db.exec('BEGIN')
  try {
    const result = replaceReferenceTagGroupWithinTransaction(assetId, application, reference, group, value)
    db.exec('COMMIT')
    return result
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
