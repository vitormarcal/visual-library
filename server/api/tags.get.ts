import { ensureDataStore, listTagSummaries } from '../db'
import { getQuery } from 'h3'

export default defineEventHandler(async event => {
  await ensureDataStore()

  return listTagSummaries(getQuery(event).hidden === '1')
})
