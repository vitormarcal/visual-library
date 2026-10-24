import { createError } from 'h3'
import { createOwnerSession, ownerPasswordHash, verifyOwnerPassword } from '../../access-store.ts'
import { accessConfig, accessHttpError, writeSessionCookie } from '../../auth.ts'
import { checkPasswordAttempt, beginPasswordDerivation } from '../../auth-attempts.ts'
import { readLimitedRequest } from '../../image-upload.ts'
export default defineEventHandler(async event => {
  checkPasswordAttempt(event)
  let finish: (() => void) | undefined
  try {
    let body: { password?: unknown }
    try { body = JSON.parse((await readLimitedRequest(event, 4096, 10000)).toString('utf8')) }
    catch (error) { if ([408, 413].includes((error as { statusCode?: number }).statusCode ?? 0)) throw error; throw createError({ statusCode: 400, statusMessage: 'Invalid login.' }) }
    if (!body || typeof body.password !== 'string' || !body.password || body.password.length > 1024) throw createError({ statusCode: 400, statusMessage: 'Invalid login.' })
    finish = beginPasswordDerivation(event)
    const hash = await ownerPasswordHash()
    if (!hash || !await verifyOwnerPassword(body.password, hash)) throw createError({ statusCode: 401, statusMessage: 'Incorrect password or setup required.' })
    writeSessionCookie(event, await createOwnerSession(hash), accessConfig(event))
    return { authenticated: true }
  } catch (error) { accessHttpError(error) }
  finally { finish?.() }
})
