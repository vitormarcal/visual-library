import { ensureDataStore, findTag } from '../../db'

export default defineEventHandler(async (event) => {
  await ensureDataStore()
  const tag = findTag(getRouterParam(event, 'id') ?? '')
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'Tag not found.' })
  return tag
})
