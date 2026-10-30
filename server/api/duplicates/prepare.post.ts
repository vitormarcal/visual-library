import { activateDuplicates } from '../../duplicate-preparation.ts'
export default defineEventHandler(async () => { await activateDuplicates(); return { accepted: true } })
