import { createError } from 'h3'
import { ensureDataStore, toImageResponse, toTagResponse, thumbnailVersion, type ImageRow, type ImageTagRow } from './db.ts'
import { ensureImageDimensions } from './image-dimensions.ts'
import { normalizeSearch } from '../app/utils/image-search.ts'
import { selectRediscovery } from '../app/utils/rediscovery.ts'

export type BrowseCriteria = { hidden: boolean; query: string; tagIds: string[] }
const invalid = () => createError({ statusCode: 400, statusMessage: 'Invalid library query.' })
export function browseCriteria(query: Record<string, unknown>): BrowseCriteria {
  const tags = query.tag === undefined ? [] : Array.isArray(query.tag) ? query.tag : [query.tag]
  if (typeof (query.q ?? '') !== 'string' || String(query.q ?? '').length > 1000
    || tags.length > 3 || tags.some(tag => typeof tag !== 'string' || !tag || tag.length > 100)
    || (query.hidden !== undefined && (typeof query.hidden !== 'string' || !['0', '1'].includes(query.hidden)))) throw invalid()
  return { hidden: query.hidden === '1', query: normalizeSearch(String(query.q ?? '')), tagIds: [...new Set(tags as string[])] }
}

function where(criteria: BrowseCriteria) {
  const clauses = ['i.hidden_from_gallery = ?']
  const params: (string | number)[] = [Number(criteria.hidden)]
  for (const id of criteria.tagIds) {
    clauses.push('EXISTS (SELECT 1 FROM image_tags it WHERE it.image_id = i.id AND it.tag_id = ?)')
    params.push(id)
  }
  for (const term of criteria.query.split(' ').filter(Boolean)) {
    clauses.push(`(instr(normalize_search(i.original_name), ?) > 0 OR EXISTS (
      SELECT 1 FROM image_tags it JOIN tags t ON t.id = it.tag_id
      WHERE it.image_id = i.id AND instr(normalize_search(t.name), ?) > 0))`)
    params.push(term, term)
  }
  return { sql: clauses.join(' AND '), params }
}

// Fetch associations only for this bounded page. Never call getImageTags per card.
export async function browseResponses(rows: ImageRow[]) {
  if (!rows.length) return []
  await ensureImageDimensions(rows)
  const db = await ensureDataStore()
  const tags = db.prepare(`SELECT it.image_id, t.id, t.name, t.normalized_name FROM image_tags it
    JOIN tags t ON t.id = it.tag_id WHERE it.image_id IN (${rows.map(() => '?').join(',')})
    ORDER BY it.created_at ASC, t.name ASC`).all(...rows.map(row => row.id)) as (ImageTagRow & { image_id: string })[]
  const grouped = new Map<string, ImageTagRow[]>()
  for (const tag of tags) { const group = grouped.get(tag.image_id) ?? []; group.push(tag); grouped.set(tag.image_id, group) }
  return rows.map(row => toImageResponse(row, (grouped.get(row.id) ?? []).map(toTagResponse)))
}

function cursorValue(value: unknown): { date: string; id: string } | null {
  if (value === undefined) return null
  if (typeof value !== 'string' || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid()
  try {
    const [date, id] = JSON.parse(Buffer.from(value, 'base64url').toString())
    if (typeof date !== 'string' || !Number.isFinite(Date.parse(date)) || typeof id !== 'string' || !id || id.length > 100) throw invalid()
    return { date, id }
  } catch { throw invalid() }
}

export async function browseImages(criteria: BrowseCriteria, cursor?: unknown, limit = 60) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 60) throw invalid()
  const db = await ensureDataStore(), filter = where(criteria), after = cursorValue(cursor)
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM images i WHERE ${filter.sql}`).get(...filter.params) as { count: number }).count
  const rows = db.prepare(`SELECT i.* FROM images i WHERE ${filter.sql}
    ${after ? 'AND (i.created_at < ? OR (i.created_at = ? AND i.id < ?))' : ''}
    ORDER BY i.created_at DESC, i.id DESC LIMIT ?`).all(...filter.params,
    ...(after ? [after.date, after.date, after.id] : []), limit + 1) as ImageRow[]
  const page = rows.slice(0, limit), last = page.at(-1)
  const subjectTotal = criteria.tagIds.length ? (db.prepare(`SELECT COUNT(*) AS count FROM images i
    WHERE i.hidden_from_gallery = ? AND EXISTS (SELECT 1 FROM image_tags it WHERE it.image_id = i.id AND it.tag_id = ?)`)
    .get(Number(criteria.hidden), criteria.tagIds[0]!) as { count: number }).count : total
  return { images: await browseResponses(page), total, subjectTotal,
    nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify([last.created_at, last.id])).toString('base64url') : null }
}

export async function browseIds(criteria: BrowseCriteria) {
  const db = await ensureDataStore(), filter = where(criteria)
  return (db.prepare(`SELECT i.id FROM images i WHERE ${filter.sql} ORDER BY i.created_at DESC, i.id DESC`)
    .all(...filter.params) as { id: string }[]).map(row => row.id)
}

export async function librarySummary() {
  const db = await ensureDataStore()
  const row = db.prepare(`SELECT COUNT(*) AS images, COALESCE(SUM(size_bytes), 0) AS bytes,
    COALESCE(SUM(hidden_from_gallery = 0), 0) AS visible FROM images`).get() as { images: number; bytes: number; visible: number }
  return { ...row, tags: (db.prepare('SELECT COUNT(DISTINCT tag_id) AS count FROM image_tags').get() as { count: number }).count }
}

export async function browseImage(id: string) {
  const db = await ensureDataStore()
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  return (await browseResponses([row]))[0]!
}

export async function browseNeighbors(id: string, criteria: BrowseCriteria) {
  const db = await ensureDataStore(), filter = where(criteria)
  const row = db.prepare(`SELECT i.* FROM images i WHERE i.id = ? AND ${filter.sql}`).get(id, ...filter.params) as ImageRow | undefined
  if (!row) return { previous: null, next: null }
  const neighbor = (previous: boolean) => db.prepare(`SELECT i.* FROM images i WHERE ${filter.sql}
    AND (i.created_at ${previous ? '>' : '<'} ? OR (i.created_at = ? AND i.id ${previous ? '>' : '<'} ?))
    ORDER BY i.created_at ${previous ? 'ASC' : 'DESC'}, i.id ${previous ? 'ASC' : 'DESC'} LIMIT 1`)
    .get(...filter.params, row.created_at, row.created_at, row.id) as ImageRow | undefined
  const previous = neighbor(true), next = neighbor(false)
  const images = await browseResponses([previous, next].filter((row): row is ImageRow => Boolean(row)))
  return { previous: images.find(image => image.id === previous?.id) ?? null, next: images.find(image => image.id === next?.id) ?? null }
}

export async function rediscoveryImages(previous: string[]) {
  const db = await ensureDataStore()
  const candidates = (db.prepare('SELECT id, created_at FROM images WHERE hidden_from_gallery = 0').all() as { id: string; created_at: string }[])
    .map(row => ({ id: row.id, createdAt: row.created_at, hiddenFromGallery: false }))
  const selection = selectRediscovery(candidates, previous)
  const rows = selection.ids.map(id => db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow)
  return { ...selection, images: await browseResponses(rows) }
}

export async function libraryFolders() {
  const db = await ensureDataStore()
  // Only three rows per tag leave SQLite, including its stable persisted cover.
  const rows = db.prepare(`WITH ranked AS (
    SELECT t.id AS tag_id, t.name, t.normalized_name, i.*,
      COUNT(*) OVER (PARTITION BY t.id) AS image_count,
      ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY (i.id = t.cover_image_id) DESC, i.created_at ASC, i.id ASC) AS rank
    FROM tags t JOIN image_tags it ON it.tag_id = t.id JOIN images i ON i.id = it.image_id
    WHERE i.hidden_from_gallery = 0)
    SELECT * FROM ranked WHERE rank <= 3`).all() as (ImageRow & { tag_id: string; name: string; normalized_name: string; image_count: number })[]
  const groups = new Map<string, { id: string; name: string; normalizedName: string; imageCount: number; previews: ReturnType<typeof preview>[] }>()
  for (const row of rows) {
    const group = groups.get(row.tag_id) ?? { id: row.tag_id, name: row.name, normalizedName: row.normalized_name, imageCount: row.image_count, previews: [] }
    group.previews.push(preview(row)); groups.set(row.tag_id, group)
  }
  return [...groups.values()].sort((a, b) => b.imageCount - a.imageCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}
function preview(row: ImageRow) {
  return { id: row.id, src: `/images/${encodeURIComponent(row.filename)}`,
    thumbnailSrc: row.content_hash ? `/thumbnails/${encodeURIComponent(row.id)}?v=${thumbnailVersion}&hash=${row.content_hash}` : null,
    width: row.width, height: row.height }
}

export async function relatedPage(id: string, offset?: number) {
  const db = await ensureDataStore()
  const reference = db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow | undefined
  if (!reference) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })
  const rows = db.prepare(`SELECT i.*, (SELECT COUNT(*) FROM image_tags a JOIN image_tags b ON b.tag_id = a.tag_id
    WHERE a.image_id = ? AND b.image_id = i.id) AS shared FROM images i
    WHERE i.id != ? AND i.hidden_from_gallery = ?
    ORDER BY shared DESC, i.created_at DESC, i.id DESC LIMIT 25 OFFSET ?`)
    .all(id, id, reference.hidden_from_gallery, offset ?? 0) as (ImageRow & { shared: number })[]
  // First request is the existing six shared-tag recommendations. More also includes the fallback library.
  const page = offset === undefined ? rows.filter(row => row.shared > 0).slice(0, 6) : rows.slice(0, 24)
  return { images: await browseResponses(page), nextOffset: offset === undefined ? (rows.length > page.length ? page.length : null) : rows.length > 24 ? offset + 24 : null,
    hasCandidates: rows.length > 0 }
}
