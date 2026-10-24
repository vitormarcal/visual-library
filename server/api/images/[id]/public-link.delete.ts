import { getRouterParam } from 'h3'
import { revokePublicImageLink } from '../../../access-store.ts'
import { requireOwner } from '../../../auth.ts'
export default defineEventHandler(async event => {
  requireOwner(event)
  await revokePublicImageLink(getRouterParam(event, 'id') ?? '')
  return { url: null }
})
