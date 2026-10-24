import { deleteOwnerSession } from '../../access-store.ts'
import { accessConfig, ownerCookie, requireOwner, writeSessionCookie } from '../../auth.ts'
export default defineEventHandler(async event => {
  requireOwner(event)
  await deleteOwnerSession(ownerCookie(event)!)
  writeSessionCookie(event, '', accessConfig(event))
  return { authenticated: false }
})
