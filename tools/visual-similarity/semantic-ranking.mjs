import { matchesImageSearch } from '../../app/utils/image-search.ts'
import { semanticPolicy, normalizedVector } from '../../runtime/similarity/semantic-features.mjs'
export { semanticPolicy, semanticFingerprint, digest, normalizedVector, validSemanticCache } from '../../runtime/similarity/semantic-features.mjs'
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
