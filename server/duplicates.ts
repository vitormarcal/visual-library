import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { unlink } from 'node:fs/promises'
import { createError } from 'h3'
import { ensureDataStore, getImageTags, toImageResponse, normalizeTagValues, addImageTagsWithinTransaction, reconcileTagCovers, imageDir, type ImageRow } from './db.ts'
import { removeThumbnails } from './thumbnails.ts'
import { duplicateProgress, duplicatesEnabled, duplicatesPreparing, duplicatesUnavailable } from './duplicate-preparation.ts'
import { duplicateComponents, duplicateDigest, duplicateFingerprint, duplicateVector } from '../runtime/similarity/duplicate-features.mjs'
import type { DuplicateGroup, DuplicateReviewResponse } from '../app/utils/duplicate-review.ts'
type Pair = { a: string; b: string; distance: number }
let cachedKey = '', cachedPairs: Pair[] = []
let pending: { key: string; promise: Promise<Pair[]> } | null = null
function rank(images: { id: string; vector: number[] }[], key: string) {
  if (cachedKey === key) return Promise.resolve(cachedPairs)
  if (pending?.key === key) return pending.promise
  const worker = new Worker(join(process.cwd(), 'runtime/similarity/duplicate-ranking.mjs'), { workerData: images, execArgv: [] })
  const promise = new Promise<Pair[]>((resolve, reject) => {
    const timeout = setTimeout(() => { void worker.terminate(); reject(new Error('Duplicate ranking timed out')) }, 60_000)
    worker.once('message', pairs => { clearTimeout(timeout); resolve(pairs) })
    worker.once('error', error => { clearTimeout(timeout); reject(error) })
    worker.once('exit', code => { clearTimeout(timeout); if (code !== 0) reject(new Error('Duplicate ranking unavailable')) })
  }).then(pairs => { cachedKey = key; cachedPairs = pairs; return pairs }).finally(() => { if (pending?.key === key) pending = null })
  pending = { key, promise }
  return promise
}
function groupRevision(db: Awaited<ReturnType<typeof ensureDataStore>>, ids: string[]) {
  return duplicateDigest(ids.map(id => ({
    row: db.prepare('SELECT id,content_hash,hidden_from_gallery,width,height,size_bytes FROM images WHERE id=?').get(id) ?? null,
    tags: getImageTags(id),
    links: db.prepare(`SELECT token,created_at FROM image_public_links WHERE image_id=? UNION ALL
      SELECT token,created_at FROM image_public_link_aliases WHERE image_id=? ORDER BY token`).all(id, id),
    references: db.prepare('SELECT * FROM asset_references WHERE asset_id=? ORDER BY application,entity_type,entity_id').all(id),
    vector: db.prepare('SELECT fingerprint,source_hash,status FROM image_duplicate_vectors WHERE image_id=?').get(id) ?? null,
  })))
}
export async function duplicateGroups(broad = false): Promise<DuplicateGroup[]> {
  const db = await ensureDataStore()
  const rows = db.prepare(`SELECT i.*,v.vector_json FROM images i JOIN image_duplicate_vectors v ON v.image_id=i.id
    AND v.fingerprint=? AND v.source_hash IS i.content_hash AND v.status='ready'
    WHERE i.hidden_from_gallery=0 ORDER BY i.id`).all(duplicateFingerprint) as Array<ImageRow & { vector_json: string }>
  const vectors: { id: string; vector: number[] }[] = [], valid: typeof rows = []
  for (const row of rows) {
    try { vectors.push({ id: row.id, vector: duplicateVector(row.vector_json) }); valid.push(row) }
    catch { db.prepare("UPDATE image_duplicate_vectors SET status='failed',vector_json=NULL WHERE image_id=?").run(row.id) }
  }
  const key = duplicateDigest(valid.map(row => [row.id, row.content_hash, row.vector_json]))
  const pairs = await rank(vectors, key)
  // Revalidate after the worker yielded; never construct an actionable group from stale eligibility.
  const current = db.prepare(`SELECT i.id,i.content_hash,v.vector_json FROM images i JOIN image_duplicate_vectors v ON v.image_id=i.id
    AND v.fingerprint=? AND v.source_hash IS i.content_hash AND v.status='ready' WHERE i.hidden_from_gallery=0 ORDER BY i.id`).all(duplicateFingerprint) as Array<{ id: string; content_hash: string | null; vector_json: string }>
  if (duplicateDigest(current.map(row => [row.id, row.content_hash, row.vector_json])) !== key) throw createError({ statusCode: 409, statusMessage: 'Images changed. Refresh the review.' })
  const byId = new Map(valid.map(row => [row.id, row]))
  const groups: DuplicateGroup[] = []
  for (const ids of duplicateComponents(pairs, broad ? .1 : .03) as string[][]) {
    const id = duplicateDigest([duplicateFingerprint, ids.map(id => [id, byId.get(id)!.content_hash])])
    if (db.prepare('SELECT 1 FROM duplicate_reviews WHERE group_id=?').get(id)) continue
    const images = ids.map(id => {
      // Metadata may have changed while ranking; use current records/tags.
      const row = db.prepare('SELECT * FROM images WHERE id=?').get(id) as ImageRow
      const links = db.prepare(`SELECT (SELECT count(*) FROM image_public_links WHERE image_id=?) +
        (SELECT count(*) FROM image_public_link_aliases WHERE image_id=?) AS n`).get(id, id) as { n: number }
      const references = db.prepare('SELECT count(*) AS n FROM asset_references WHERE asset_id=?').get(id) as { n: number }
      return { ...toImageResponse(row), publicLinkCount: links.n, integrationReferenceCount: references.n }
    })
    groups.push({ id, revision: groupRevision(db, ids), images })
  }
  return groups
}
export async function duplicateReviewStatus(broad = false): Promise<DuplicateReviewResponse> {
  const progress = await duplicateProgress()
  const state = !duplicatesEnabled() ? 'inactive' : duplicatesUnavailable() ? 'unavailable'
    : duplicatesPreparing() || progress.pendingCount ? 'preparing' : 'ready'
  if (state !== 'ready') return { ...progress, state, groups: [] }
  const groups = await duplicateGroups(broad)
  return { ...await duplicateProgress(), state, groups }
}
function conflict() { return createError({ statusCode: 409, statusMessage: 'This group changed. Refresh before confirming.' }) }
export async function resolveDuplicateGroup(input: unknown) {
  const body = input as { groupId?: unknown; revision?: unknown; keepIds?: unknown; targetId?: unknown; broad?: unknown }
  if (!body || typeof body.groupId !== 'string' || typeof body.revision !== 'string' || !Array.isArray(body.keepIds)
    || !body.keepIds.length || body.keepIds.some(id => typeof id !== 'string') || new Set(body.keepIds).size !== body.keepIds.length
    || typeof body.broad !== 'boolean' || !(body.targetId === null || typeof body.targetId === 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'Choose images to keep and a destination for tags and links.' })
  }
  const keepIds = body.keepIds as string[]
  const group = (await duplicateGroups(body.broad)).find(group => group.id === body.groupId)
  if (!group || group.revision !== body.revision) throw conflict()
  const ids = group.images.map(image => image.id)
  if (keepIds.some(id => !ids.includes(id))) throw createError({ statusCode: 400, statusMessage: 'Invalid kept image.' })
  const removed = group.images.filter(image => !keepIds.includes(image.id))
  if (removed.some(image => image.integrationReferenceCount)) throw createError({ statusCode: 409, statusMessage: 'Images used by an integration must be kept.' })
  const needsTarget = removed.some(image => image.tags.length || image.publicLinkCount)
  const targetId = keepIds.length === 1 ? keepIds[0]! : (body.targetId as string | null) ?? (!needsTarget ? keepIds[0]! : null)
  if (removed.length && (!targetId || !keepIds.includes(targetId))) throw createError({ statusCode: 400, statusMessage: 'Choose where to preserve tags and public links.' })
  const db = await ensureDataStore(), files: { id: string; filename: string }[] = []
  db.exec('BEGIN IMMEDIATE')
  try {
    if (groupRevision(db, ids) !== body.revision || db.prepare('SELECT 1 FROM duplicate_reviews WHERE group_id=?').get(group.id)) throw conflict()
    const affected = new Set(ids.flatMap(id => getImageTags(id).map(tag => tag.id)))
    if (removed.length) {
      addImageTagsWithinTransaction([targetId!], normalizeTagValues(removed.flatMap(image => getImageTags(image.id).map(tag => tag.name))))
      for (const image of removed) {
        const row = db.prepare('SELECT filename FROM images WHERE id=?').get(image.id) as { filename: string }
        files.push({ id: image.id, filename: row.filename })
        const primary = db.prepare('SELECT token FROM image_public_links WHERE image_id=?').get(image.id) as { token: string } | undefined
        if (primary) {
          if (!db.prepare('SELECT 1 FROM image_public_links WHERE image_id=?').get(targetId!)) db.prepare('UPDATE image_public_links SET image_id=? WHERE image_id=?').run(targetId!, image.id)
          else {
            db.prepare('INSERT INTO image_public_link_aliases (token,image_id,created_at) SELECT token,?,created_at FROM image_public_links WHERE image_id=?').run(targetId!, image.id)
            db.prepare('DELETE FROM image_public_links WHERE image_id=?').run(image.id)
          }
        }
        db.prepare('UPDATE image_public_link_aliases SET image_id=? WHERE image_id=?').run(targetId!, image.id)
        for (const [table, column] of [['image_tags','image_id'],['image_visual_features','image_id'],['image_semantic_vectors','image_id'],['image_duplicate_vectors','image_id'],['asset_reference_tag_groups','asset_id'],['asset_references','asset_id']]) {
          db.prepare(`DELETE FROM ${table} WHERE ${column}=?`).run(image.id)
        }
        db.prepare('DELETE FROM images WHERE id=?').run(image.id)
      }
      reconcileTagCovers([...affected])
    }
    const reviewedAt = new Date().toISOString()
    db.prepare('INSERT INTO duplicate_reviews (group_id,reviewed_at) VALUES (?,?)').run(group.id, reviewedAt)
    // Several deliberately kept variants must not immediately reappear as a smaller group.
    const keptSet = new Set(keepIds)
    for (const survivors of duplicateComponents(cachedPairs.filter(pair => keptSet.has(pair.a) && keptSet.has(pair.b)), body.broad ? .1 : .03) as string[][]) {
      const survivorId = duplicateDigest([duplicateFingerprint, survivors.map(id => [id, db.prepare('SELECT content_hash FROM images WHERE id=?').get(id)!.content_hash])])
      db.prepare('INSERT OR IGNORE INTO duplicate_reviews (group_id,reviewed_at) VALUES (?,?)').run(survivorId, reviewedAt)
    }
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  // Only remove files after metadata, tags and aliases committed successfully.
  await Promise.all(files.map(async file => {
    if (!file.filename.includes('/') && !file.filename.includes('\\')) await unlink(join(imageDir, file.filename)).catch(() => {})
    await removeThumbnails(file.id).catch(() => {})
  }))
  return { removedIds: removed.map(image => image.id), images: keepIds.map(id => toImageResponse(db.prepare('SELECT * FROM images WHERE id=?').get(id) as ImageRow)) }
}
