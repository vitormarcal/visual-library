import { createError } from 'h3'
import { createApplicationToken } from '../../access-store.ts'
import { accessHttpError, requireOwner } from '../../auth.ts'
import { readLimitedRequest } from '../../image-upload.ts'
export default defineEventHandler(async event => {
  requireOwner(event)
  try {
    let body: { name?: unknown }
    try { body = JSON.parse((await readLimitedRequest(event, 2048)).toString('utf8')) }
    catch (error) { if ((error as { statusCode?: number }).statusCode === 413) throw error; throw createError({ statusCode: 400, statusMessage: 'Invalid credential.' }) }
    return await createApplicationToken(body?.name)
  } catch (error) { accessHttpError(error) }
})
