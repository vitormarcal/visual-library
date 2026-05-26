import { ensureDataStore, toImageResponse, toTagResponse, type ImageRow, type ImageTagRow } from '../db'

export default defineEventHandler(async () => {
  const db = await ensureDataStore()
  const rows = db
    .prepare('SELECT * FROM images ORDER BY created_at DESC')
    .all() as ImageRow[]
  const tagRows = db.prepare(`
    SELECT image_tags.image_id, tags.id, tags.name, tags.normalized_name
    FROM image_tags
    INNER JOIN tags ON tags.id = image_tags.tag_id
    ORDER BY image_tags.created_at ASC, tags.name ASC
  `).all() as Array<ImageTagRow & { image_id: string }>
  const tagsByImageId = new Map<string, ImageTagRow[]>()

  for (const tag of tagRows) {
    const tags = tagsByImageId.get(tag.image_id) ?? []
    tags.push(tag)
    tagsByImageId.set(tag.image_id, tags)
  }

  return rows.map((row) => toImageResponse(row, (tagsByImageId.get(row.id) ?? []).map(toTagResponse)))
})
