import { hasOwnerSession, ownerAccessState } from '../../access-store.ts'
import { ownerCookie } from '../../auth.ts'
export default defineEventHandler(async event => ({ authenticated: await hasOwnerSession(ownerCookie(event)), ...await ownerAccessState() }))
