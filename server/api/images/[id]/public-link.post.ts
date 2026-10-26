import { getRouterParam } from 'h3'
import { publicImageLink } from '../../../access-store.ts'
import { accessConfig, accessHttpError, requirePublicLinkPublisher } from '../../../auth.ts'
export default defineEventHandler(async event => {
  requirePublicLinkPublisher(event)
  try { return { url: accessConfig(event).origin + await publicImageLink(getRouterParam(event, 'id') ?? '', true) } }
  catch (error) { accessHttpError(error) }
})
