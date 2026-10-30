import { getRouterParam } from 'h3'
import { publicImageLink, publicImageLinkCount } from '../../../access-store.ts'
import { accessConfig, accessHttpError, requirePublicLinkPublisher } from '../../../auth.ts'
export default defineEventHandler(async event => {
  requirePublicLinkPublisher(event)
  try { const path = await publicImageLink(getRouterParam(event, 'id') ?? ''); return { url: path ? accessConfig(event).origin + path : null, count: await publicImageLinkCount(getRouterParam(event, 'id') ?? '') } }
  catch (error) { accessHttpError(error) }
})
