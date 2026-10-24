import { listApplicationTokens } from '../../access-store.ts'
import { requireOwner } from '../../auth.ts'
export default defineEventHandler(event => { requireOwner(event); return listApplicationTokens() })
