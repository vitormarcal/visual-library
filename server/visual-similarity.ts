import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { descriptorVersion, validDescriptor, visualSimilarity } from '../runtime/similarity/features.mjs'
import { ensureDataStore, toImageResponse, type ImageRow } from './db.ts'
import { prepareSimilarity, similarityUnavailable } from './similarity-preparation.ts'

type Features = { embedding: number[]; palette: number[]; spatial: number[] }
type FeatureRow = ImageRow & { status: string | null; features_json: string | null }
type Snapshot = { referenceId: string; ids: string[]; createdAt: number; readyCount: number }
const snapshots = new Map<string, Snapshot>()
const pageSize = 24
export const snapshotLifetime = 30 * 60_000

function parseFeatures(value: string | null): Features | null {
  try { const parsed = JSON.parse(value ?? 'null'); return validDescriptor(parsed) ? parsed : null } catch { return null }
}

export async function similarImages(referenceId: string, query: { snapshot?: unknown; offset?: unknown }) {
  const snapshotId = query.snapshot
  if ((snapshotId !== undefined && (typeof snapshotId !== 'string' || !/^[\da-f-]{36}$/.test(snapshotId)))
    || (query.offset !== undefined && (typeof query.offset !== 'string' || !/^\d{1,7}$/.test(query.offset)))
    || (query.offset !== undefined && !snapshotId)) throw createError({ statusCode: 400, statusMessage: 'Invalid similar images page.' })
  const offset = Number(query.offset ?? 0)
  const db = await ensureDataStore()
  const rows = db.prepare(`SELECT i.*, d.status, d.features_json FROM images i
    LEFT JOIN image_visual_features d ON d.image_id = i.id AND d.version = ? AND d.source_hash IS i.content_hash
    WHERE i.hidden_from_gallery = 0 ORDER BY i.id`).all(descriptorVersion) as FeatureRow[]
  const reference = rows.find(row => row.id === referenceId)
  if (!reference) throw createError({ statusCode: 404, statusMessage: 'This reference is no longer available.' })
  const ready = rows.map(row => ({ row, features: row.status === 'ready' ? parseFeatures(row.features_json) : null }))
    .filter((entry): entry is { row: FeatureRow; features: Features } => Boolean(entry.features))
  const failed = rows.filter(row => row.status === 'failed' || (row.status === 'ready' && !parseFeatures(row.features_json))).length
  const pending = rows.length - ready.length - failed
  if (pending > 0) prepareSimilarity(referenceId)
  const context = { preparedCount: ready.length, totalCount: rows.length, failedCount: failed, partial: pending > 0 }
  const feature = ready.find(entry => entry.row.id === referenceId)?.features
  if (!feature) return {
    ...context, state: reference.status === 'failed' || reference.status === 'ready' ? 'failed' : similarityUnavailable() ? 'unavailable' : 'preparing',
    images: [], snapshot: null, nextOffset: null,
  }
  if (ready.length === 1 && pending > 0 && !snapshotId) return {
    ...context, state: similarityUnavailable() ? 'unavailable' : 'preparing', images: [], snapshot: null, nextOffset: null,
  }
  const now = Date.now()
  for (const [key, value] of snapshots) if (now - value.createdAt >= snapshotLifetime) snapshots.delete(key)
  let key = typeof snapshotId === 'string' ? snapshotId : ''
  let snapshot = key ? snapshots.get(key) : undefined
  if (key && (!snapshot || snapshot.referenceId !== referenceId)) throw createError({ statusCode: 410, statusMessage: 'These results expired. Refresh similar images.' })
  if (!snapshot) {
    const ids = ready.filter(entry => entry.row.id !== referenceId)
      .map(entry => ({ id: entry.row.id, score: visualSimilarity(feature, entry.features) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en')).map(entry => entry.id)
    snapshot = { referenceId, ids, createdAt: now, readyCount: ready.length }
    while (snapshots.size >= 100) snapshots.delete(snapshots.keys().next().value!)
    key = randomUUID()
    snapshots.set(key, snapshot)
  }
  if (offset > snapshot.ids.length) throw createError({ statusCode: 400, statusMessage: 'Invalid similar images page.' })
  const visible = new Map(rows.map(row => [row.id, row]))
  const page: ImageRow[] = []
  let next = offset
  while (next < snapshot.ids.length && page.length < pageSize) {
    const row = visible.get(snapshot.ids[next++]!)
    if (row) page.push(row)
  }
  return { ...context, partial: context.partial || ready.length > snapshot.readyCount, state: 'ready', images: page.map(row => toImageResponse(row)), snapshot: key, nextOffset: next < snapshot.ids.length ? next : null }
}

export async function retrySimilarImage(id: string) {
  const db = await ensureDataStore()
  if (!db.prepare('SELECT id FROM images WHERE id = ? AND hidden_from_gallery = 0').get(id)) {
    throw createError({ statusCode: 404, statusMessage: 'This reference is no longer available.' })
  }
  const row = db.prepare('SELECT status, features_json FROM image_visual_features WHERE image_id = ?').get(id) as { status: string; features_json: string | null } | undefined
  if (row && (row.status === 'failed' || !parseFeatures(row.features_json))) db.prepare('DELETE FROM image_visual_features WHERE image_id = ?').run(id)
  prepareSimilarity(id, true)
  return { preparing: true }
}
