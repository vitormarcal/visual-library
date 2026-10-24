import { createError } from 'h3'
import { toImageResponse } from './db.ts'
import { semanticEnabled, semanticModelsReady, semanticPreparing, semanticUnavailable, prepareSemanticSearch, semanticTextVector } from './semantic-preparation.ts'
import { semanticProgress, semanticRows, parseSemanticVector } from './semantic-store.ts'
export async function contentSearchStatus() {
  const progress = await semanticProgress()
  const enabled = semanticEnabled()
  if (enabled && progress.totalCount && (progress.pendingCount || !semanticModelsReady()) && !semanticPreparing() && !semanticUnavailable()) void prepareSemanticSearch()
  const state = !enabled ? 'inactive' : semanticUnavailable() ? 'unavailable'
    : semanticPreparing() || (progress.totalCount && (progress.pendingCount > 0 || !semanticModelsReady())) ? 'preparing' : 'ready'
  return { state, ...progress, partial: progress.pendingCount > 0 || progress.failedCount > 0 }
}
export async function contentSearch(body: unknown) {
  const input = body as { query?: unknown; tagIds?: unknown }
  if (!input || typeof input.query !== 'string' || !input.query.trim() || input.query.length > 500
    || (input.tagIds !== undefined && (!Array.isArray(input.tagIds) || input.tagIds.length > 3 || input.tagIds.some(id => typeof id !== 'string' || !id || id.length > 128)))) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a description of up to 500 characters and up to three tags.' })
  }
  const query = input.query.trim(), tagIds = [...new Set((input.tagIds ?? []) as string[])]
  const status = await contentSearchStatus()
  if (status.state !== 'ready' || !status.totalCount) return { ...status, images: [] }
  let reference: number[]
  try { reference = await semanticTextVector(query) }
  catch { return { ...status, state: 'unavailable', images: [] } }
  // Read eligibility after inference, not before: metadata may change while loading text.
  const rows = await semanticRows(tagIds)
  const ranked = rows.flatMap(row => {
    const vector = row.vector_status === 'ready' ? parseSemanticVector(row.vector_json) : null
    return vector ? [{ row, score: vector.reduce((sum, value, i) => sum + value * reference[i]!, 0) }] : []
  }).sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id, 'en'))
  return { ...await contentSearchStatus(), state: 'ready', images: ranked.slice(0, 24).map(item => toImageResponse(item.row)) }
}
