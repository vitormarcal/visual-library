import { ensureDataStore, listTagSummaries } from '../db'

export default defineEventHandler(async () => {
  await ensureDataStore()

  return listTagSummaries()
})
