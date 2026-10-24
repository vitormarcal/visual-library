import { getRouterParam } from 'h3'
import { publicImageLink } from '../../../access-store.ts'
import { accessConfig, accessHttpError, requireOwner } from '../../../auth.ts'
export default defineEventHandler(async event => {
  requireOwner(event)
  try { const path = await publicImageLink(getRouterParam(event, 'id') ?? ''); return { url: path ? accessConfig(event).origin + path : null } }
  catch (error) { accessHttpError(error) }
})
