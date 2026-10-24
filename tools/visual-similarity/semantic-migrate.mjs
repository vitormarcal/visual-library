import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { digest } from './semantic-ranking.mjs'

export function migrateJudgments(previous, judgments, current) {
  if (judgments.version !== 1 || ['fingerprint', 'datasetHash', 'queriesHash'].some(key => judgments[key] !== previous[key])) throw new Error('Judgments do not belong to the previous experiment')
  if (current.fingerprint !== previous.fingerprint || current.queriesHash !== previous.queriesHash) throw new Error('Migration requires the same model and queries')
  const oldImages = new Map(previous.images.map(image => [image.id, image.sha256]))
  const newImages = new Map(current.images.map(image => [image.id, image.sha256]))
  const oldQueries = new Map(previous.queries.map(query => [query.id, new Set(query.candidates)]))
  const newQueries = new Map(current.queries.map(query => [query.id, new Set(query.candidates)]))
  const grades = Object.create(null)
  let copied = 0, skipped = 0
  for (const [queryId, values] of Object.entries(judgments.grades ?? {})) {
    for (const [imageId, grade] of Object.entries(values)) {
      if (!oldQueries.get(queryId)?.has(imageId) || ![0, 1, 2].includes(grade)) throw new Error('Invalid source judgment')
      if (!newQueries.get(queryId)?.has(imageId) || !oldImages.has(imageId) || oldImages.get(imageId) !== newImages.get(imageId)) { skipped++; continue }
      ;(grades[queryId] ??= Object.create(null))[imageId] = grade
      copied++
    }
  }
  return { version: 1, fingerprint: current.fingerprint, datasetHash: current.datasetHash, queriesHash: current.queriesHash, grades,
    provenance: { method: 'same-image-id-and-sha256', previousDatasetHash: previous.datasetHash, sourceJudgmentsHash: digest(judgments), copied, skipped } }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { values } = parseArgs({ options: { previous: { type: 'string' }, judgments: { type: 'string' }, results: { type: 'string' }, out: { type: 'string' } } })
  if (!values.previous || !values.judgments || !values.results || !values.out) throw new Error('Usage: node semantic-migrate.mjs --previous /old/results.json --judgments /old/judgments.exported.json --results /new/results.json --out /new/judgments.seed.json')
  const load = async path => JSON.parse(await readFile(path, 'utf8'))
  const result = migrateJudgments(await load(values.previous), await load(values.judgments), await load(values.results))
  await writeFile(values.out, JSON.stringify(result, null, 2), { flag: 'wx' })
  console.log(JSON.stringify(result.provenance))
}
