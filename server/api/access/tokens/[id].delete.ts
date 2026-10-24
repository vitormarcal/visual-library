import { getRouterParam } from 'h3'
import { revokeApplicationToken } from '../../../access-store.ts'
import { accessHttpError, requireOwner } from '../../../auth.ts'
export default defineEventHandler(async event => {
  requireOwner(event)
  try { await revokeApplicationToken(getRouterParam(event, 'id') ?? ''); return { revoked: true } }
  catch (error) { accessHttpError(error) }
})
