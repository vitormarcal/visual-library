import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { retrievalQuality } from './semantic-ranking.mjs'
const { values } = parseArgs({ options: { results: { type: 'string' }, judgments: { type: 'string' }, out: { type: 'string' } } })
if (!values.results || !values.judgments || !values.out) throw new Error('Usage: node semantic-score.mjs --results /private/results.json --judgments /private/judgments.json --out /private/quality.json')
const results = JSON.parse(await readFile(values.results, 'utf8')), judgments = JSON.parse(await readFile(values.judgments, 'utf8'))
if (judgments.version !== 1 || ['fingerprint', 'datasetHash', 'queriesHash'].some(key => judgments[key] !== results[key])) throw new Error('Judgments belong to another model, dataset or query set')
const quality = results.queries.map(query => ({ id: query.id, text: query.text, language: query.language, source: query.source,
  semantic: retrievalQuality(query.semantic, query.candidates, judgments.grades?.[query.id] ?? {}),
  lexical: retrievalQuality(query.lexical, query.candidates, judgments.grades?.[query.id] ?? {}) }))
await writeFile(values.out, JSON.stringify({ fingerprint: results.fingerprint, datasetHash: results.datasetHash, queriesHash: results.queriesHash, queries: quality }, null, 2))
console.log(JSON.stringify({ completeQueries: quality.filter(q => q.semantic.status === 'complete').length, totalQueries: quality.length }))
