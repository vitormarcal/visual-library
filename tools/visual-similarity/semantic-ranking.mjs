import { createHash } from 'node:crypto'
import { matchesImageSearch } from '../../app/utils/image-search.ts'
export const semanticPolicy = {
  version: 'siglip2-evaluation-v1', model: 'onnx-community/siglip2-base-patch16-224-ONNX',
  revision: 'ba1f3b0843f24bc5417d38e19c37b287d719b2f4', dtype: 'q8', dimensions: 768,
  transformers: '4.3.1', threads: 2,
  preprocessing: 'official-fixres224;exif;first-frame;white-alpha;srgb;40MP;raw-text;max-length64',
}
export const digest = value => createHash('sha256').update(typeof value === 'string' || ArrayBuffer.isView(value) ? value : JSON.stringify(value)).digest('hex')
export const semanticFingerprint = digest(semanticPolicy)
export function normalizedVector(values) {
  if (!values || values.length !== semanticPolicy.dimensions || !Array.from(values).every(Number.isFinite)) throw new Error('Invalid semantic vector')
  const norm = Math.hypot(...values)
  if (!norm) throw new Error('Empty semantic vector')
  return Array.from(values, value => value / norm)
}
export function validSemanticCache(value, sourceHash) {
  if (value?.fingerprint !== semanticFingerprint || value?.sourceHash !== sourceHash) return false
  try { const normalized = normalizedVector(value.vector); return normalized.every((v, i) => Math.abs(v - value.vector[i]) < 1e-5) } catch { return false }
}
export function rankSemantic(queryVector, images, tagNames = []) {
  const query = normalizedVector(queryVector)
  return images.filter(image => !image.hiddenFromGallery && tagNames.every(tag => image.tags.some(t => t.name.toLowerCase() === tag.toLowerCase())))
    .map(image => ({ id: image.id, score: normalizedVector(image.vector).reduce((sum, value, i) => sum + value * query[i], 0) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en'))
}
export function rankLexical(query, images, tagNames = []) {
  // The product's exact matcher remains the baseline; metadata order is newest-first.
  return images.filter(image => !image.hiddenFromGallery && tagNames.every(tag => image.tags.some(t => t.name.toLowerCase() === tag.toLowerCase())))
    .filter(image => matchesImageSearch(image, query)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id, 'en')).map(image => ({ id: image.id }))
}
export function retrievalQuality(ranking, candidateIds, grades) {
  const provided = candidateIds.filter(id => Object.hasOwn(grades, id))
  if (provided.some(id => ![0, 1, 2].includes(grades[id]))) throw new Error('Invalid relevance grade')
  if (provided.length !== candidateIds.length) return { status: 'incomplete', judged: provided.length, candidates: candidateIds.length }
  const relevant = candidateIds.filter(id => grades[id] > 0)
  if (!relevant.length) return { status: 'no-relevant-candidates', judged: provided.length, candidates: candidateIds.length }
  const dcg = values => values.reduce((sum, grade, i) => sum + (2 ** grade - 1) / Math.log2(i + 2), 0)
  const top = ranking.slice(0, 10)
  const ideal = candidateIds.map(id => grades[id]).sort((a, b) => b - a).slice(0, 10)
  return { status: 'complete', judged: provided.length, candidates: candidateIds.length,
    ndcg10: dcg(top.map(item => grades[item.id])) / dcg(ideal),
    recall10: top.filter(item => grades[item.id] > 0).length / relevant.length,
    success5: ranking.slice(0, 5).some(item => grades[item.id] > 0), relevantCandidates: relevant.length }
}
