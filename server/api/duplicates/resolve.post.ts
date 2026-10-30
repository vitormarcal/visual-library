import { readBody } from 'h3'
import { resolveDuplicateGroup } from '../../duplicates.ts'
export default defineEventHandler(async event => resolveDuplicateGroup(await readBody(event)))
