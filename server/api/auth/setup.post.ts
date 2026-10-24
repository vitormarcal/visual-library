import { createError } from 'h3'
import { defineOwnerPassword } from '../../access-store.ts'
import { accessHttpError } from '../../auth.ts'
import { beginPasswordAttempt } from '../../auth-attempts.ts'
import { readLimitedRequest } from '../../image-upload.ts'
export default defineEventHandler(async event => {
  const finish = beginPasswordAttempt(event)
  try {
    let body: { password?: unknown; confirmation?: unknown; generation?: unknown }
    try { body = JSON.parse((await readLimitedRequest(event, 16 * 1024)).toString('utf8')) }
    catch (error) { if ((error as { statusCode?: number }).statusCode === 413) throw error; throw createError({ statusCode: 400, statusMessage: 'Invalid password setup.' }) }
    if (!body) throw createError({ statusCode: 400, statusMessage: 'Invalid password setup.' })
    await defineOwnerPassword(body.password, body.confirmation, body.generation)
    return { authenticated: false, state: 'ready', generation: null }
  } catch (error) { accessHttpError(error) }
  finally { finish() }
})
