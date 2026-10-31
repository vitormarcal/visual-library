import { createError } from 'h3'
import { normalizeTagName, type ensureDataStore } from './db.ts'
type Store = Awaited<ReturnType<typeof ensureDataStore>>
type Classification = { application: string; entity_type: string; entity_id: string; group_name: string; tags_json: string; revision: number }
const classificationKey = (row: Classification) => JSON.stringify([row.application, row.entity_type, row.entity_id, row.group_name])
const tagNames = (json: string) => [...new Set((JSON.parse(json) as string[]).map(tag => normalizeTagName(tag).normalizedName))].sort()

// The caller owns the transaction. Validate collisions before transferring identities.
export function consolidateAssetIdentities(db: Store, sourceIds: string[], destinationId: string) {
  const classifications = new Map<string, Classification[]>()
  for (const id of [destinationId, ...sourceIds]) {
    const rows = db.prepare(`SELECT application,entity_type,entity_id,group_name,tags_json,revision
      FROM asset_reference_tag_groups WHERE asset_id=? ORDER BY application,entity_type,entity_id,group_name`).all(id) as Classification[]
    for (const row of rows) {
      const key = classificationKey(row)
      if (!classifications.has(key)) classifications.set(key, [])
      classifications.get(key)!.push(row)
    }
  }
  const winners: Classification[] = []
  for (const candidates of classifications.values()) {
    const maximum = Math.max(...candidates.map(row => row.revision)), newest = candidates.filter(row => row.revision === maximum)
    const names = JSON.stringify(tagNames(newest[0]!.tags_json))
    if (newest.some(row => JSON.stringify(tagNames(row.tags_json)) !== names)) throw createError({
      statusCode: 409, statusMessage: 'Integration classifications conflict at the same revision. Keep these images until the integration resolves the conflict.',
      data: { code: 'REFERENCE_REVISION_CONFLICT' },
    })
    winners.push(newest[0]!)
  }
  const now = new Date().toISOString()
  for (const id of sourceIds) {
    db.prepare(`INSERT INTO asset_references (asset_id,application,entity_type,entity_id,url,created_at)
      SELECT ?,application,entity_type,entity_id,url,created_at FROM asset_references WHERE asset_id=?
      ON CONFLICT(asset_id,application,entity_type,entity_id) DO NOTHING`).run(destinationId, id)
    // Existing personal intent wins; managed associations remain managed when unmodified.
    db.prepare(`INSERT INTO image_tags (image_id,tag_id,created_at,personal)
      SELECT ?,tag_id,?,personal FROM image_tags WHERE image_id=?
      ON CONFLICT(image_id,tag_id) DO UPDATE SET personal=max(image_tags.personal,excluded.personal)`).run(destinationId, now, id)
    db.prepare('UPDATE asset_id_aliases SET image_id=? WHERE image_id=?').run(destinationId, id)
    db.prepare('INSERT INTO asset_id_aliases (alias_id,image_id,created_at) VALUES (?,?,?)').run(id, destinationId, now)
  }
  for (const row of winners) {
    db.prepare(`INSERT INTO asset_reference_tag_groups (asset_id,application,entity_type,entity_id,group_name,tags_json,revision)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(asset_id,application,entity_type,entity_id,group_name)
      DO UPDATE SET tags_json=excluded.tags_json,revision=excluded.revision`).run(destinationId,
      row.application, row.entity_type, row.entity_id, row.group_name, row.tags_json, row.revision)
  }
  // Absorbing all displayed tags must not strand obsolete managed associations.
  const activeNames = new Set(winners.flatMap(row => tagNames(row.tags_json)))
  const tags = db.prepare(`SELECT it.tag_id,t.normalized_name FROM image_tags it JOIN tags t ON t.id=it.tag_id
    WHERE it.image_id=? AND it.personal=0`).all(destinationId) as Array<{ tag_id: string; normalized_name: string }>
  for (const tag of tags) if (!activeNames.has(tag.normalized_name)) {
    db.prepare('UPDATE image_tags SET personal=1 WHERE image_id=? AND tag_id=?').run(destinationId, tag.tag_id)
  }
}
