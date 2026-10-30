import { createError, getQuery } from 'h3'
import { duplicateReviewStatus } from '../../duplicates.ts'
export default defineEventHandler(async event => {
  const mode = getQuery(event).mode
  if (mode !== undefined && mode !== 'likely' && mode !== 'broad') throw createError({ statusCode: 400, statusMessage: 'Invalid review mode.' })
  return duplicateReviewStatus(mode === 'broad')
})
