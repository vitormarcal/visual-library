import { createError } from 'h3'
import { defineOwnerPassword } from '../../access-store.ts'
import { accessHttpError } from '../../auth.ts'
import { checkPasswordAttempt, beginPasswordDerivation } from '../../auth-attempts.ts'
import { readLimitedRequest } from '../../image-upload.ts'
export default defineEventHandler(async event => {
  checkPasswordAttempt(event)
  let finish: (() => void) | undefined
  try {
    let body: { password?: unknown; confirmation?: unknown; generation?: unknown }
    try { body = JSON.parse((await readLimitedRequest(event, 16 * 1024, 10000)).toString('utf8')) }
    catch (error) { if ([408, 413].includes((error as { statusCode?: number }).statusCode ?? 0)) throw error; throw createError({ statusCode: 400, statusMessage: 'Invalid password setup.' }) }
    if (!body) throw createError({ statusCode: 400, statusMessage: 'Invalid password setup.' })
    finish = beginPasswordDerivation(event)
    await defineOwnerPassword(body.password, body.confirmation, body.generation)
    return { authenticated: false, state: 'ready', generation: null }
  } catch (error) { accessHttpError(error) }
  finally { finish?.() }
})
