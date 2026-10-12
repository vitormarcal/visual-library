import { createError, getRouterParam, setHeader } from 'h3'
import { ensureDataStore, replaceAssetReferenceTagGroup, ManagedTagConflict } from '../../../../db.ts'
import { readLimitedRequest, validateManagedTagGroup } from '../../../../image-upload.ts'
export default defineEventHandler(async event => {
  const body = await readLimitedRequest(event, 16 * 1024)
  let input: Record<string, unknown>
  try { input = JSON.parse(body.toString('utf8')) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid classification.' }) }
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['application', 'entityType', 'entityId', 'group', 'tags', 'revision'].includes(key))
    || typeof input.application !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(input.application)
    || typeof input.entityType !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(input.entityType)
    || typeof input.entityId !== 'string' || !input.entityId.length || input.entityId.length > 256
    || input.entityId !== input.entityId.trim() || /[\u0000-\u001f\u007f-\u009f]/.test(input.entityId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid classification.' })
  }
  const value = validateManagedTagGroup(input.group, { tags: input.tags, revision: input.revision })
  await ensureDataStore()
  try {
    const result = replaceAssetReferenceTagGroup(getRouterParam(event, 'id') ?? '', input.application,
      { entityType: input.entityType, entityId: input.entityId }, String(input.group), value)
    if (!result) throw createError({ statusCode: 404, statusMessage: 'Asset reference not found.' })
    setHeader(event, 'Cache-Control', 'no-store')
    return result
  } catch (error) {
    if (error instanceof ManagedTagConflict) throw createError({ statusCode: 409, statusMessage: error.message, data: { code: error.code } })
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Asset classification update failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Could not update classification.' })
  }
})
