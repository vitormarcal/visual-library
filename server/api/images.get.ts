import { ensureDataStore, toImageResponse, type ImageRow } from '../db'

export default defineEventHandler(async () => {
  const db = await ensureDataStore()
  const rows = db
    .prepare('SELECT * FROM images ORDER BY created_at DESC')
    .all() as ImageRow[]

  return rows.map(toImageResponse)
})
