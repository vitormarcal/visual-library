import { ensureDataStore, type ImageRow } from './db.ts'
import { semanticFingerprint, normalizedVector } from '../runtime/similarity/semantic-features.mjs'
export type SemanticRow = ImageRow & { vector_status: string | null; vector_json: string | null }
export function parseSemanticVector(value: string | null): number[] | null {
  try {
    const vector = JSON.parse(value ?? 'null')
    const normalized = normalizedVector(vector)
    return normalized.every((v: number, i: number) => Math.abs(v - vector[i]) < 1e-5) ? normalized : null
  } catch { return null }
}
export async function semanticRows(tagIds: string[] = []) {
  const db = await ensureDataStore()
  return db.prepare(`SELECT i.*,v.status AS vector_status,v.vector_json FROM images i
    LEFT JOIN image_semantic_vectors v ON v.image_id=i.id AND v.fingerprint=? AND v.source_hash IS i.content_hash
    WHERE i.hidden_from_gallery=0 ${tagIds.length ? `AND (SELECT count(DISTINCT tag_id) FROM image_tags WHERE image_id=i.id AND tag_id IN (${tagIds.map(() => '?').join(',')}))=?` : ''}
    ORDER BY i.id`).all(semanticFingerprint, ...tagIds, ...(tagIds.length ? [tagIds.length] : [])) as SemanticRow[]
}
export async function semanticProgress() {
  const db = await ensureDataStore()
  const row = db.prepare(`SELECT count(*) AS totalCount,
    sum(CASE WHEN v.status='ready' THEN 1 ELSE 0 END) AS preparedCount,
    sum(CASE WHEN v.status='failed' THEN 1 ELSE 0 END) AS failedCount
    FROM images i LEFT JOIN image_semantic_vectors v ON v.image_id=i.id AND v.fingerprint=? AND v.source_hash IS i.content_hash
    WHERE i.hidden_from_gallery=0`).get(semanticFingerprint) as { totalCount: number; preparedCount: number | null; failedCount: number | null }
  const preparedCount = row.preparedCount ?? 0, failedCount = row.failedCount ?? 0
  return { totalCount: row.totalCount, preparedCount, failedCount, pendingCount: row.totalCount - preparedCount - failedCount }
}
export async function resetFailedSemanticVectors() {
  const db = await ensureDataStore()
  for (const row of await semanticRows()) if (row.vector_status === 'failed' || (row.vector_status === 'ready' && !parseSemanticVector(row.vector_json))) {
    db.prepare('DELETE FROM image_semantic_vectors WHERE image_id=? AND fingerprint=?').run(row.id, semanticFingerprint)
  }
}
