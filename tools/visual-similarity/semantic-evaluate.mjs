import { readFile, writeFile, mkdir, realpath, rename, readdir, stat } from 'node:fs/promises'
import { join, resolve, dirname, basename, relative, isAbsolute } from 'node:path'
import { parseArgs } from 'node:util'
import { performance } from 'node:perf_hooks'
import { cpus, totalmem, hostname } from 'node:os'
import sharp from 'sharp'
import { digest, semanticPolicy, semanticFingerprint, validSemanticCache, rankSemantic, rankLexical } from './semantic-ranking.mjs'
import { createSemanticEncoder } from './semantic-model.mjs'
import { semanticReport } from './semantic-report.mjs'
const { values } = parseArgs({ options: { dataset: { type: 'string' }, queries: { type: 'string' }, out: { type: 'string' }, models: { type: 'string' }, offline: { type: 'boolean', default: false } } })
if (!values.dataset || !values.queries || !values.out) throw new Error('Usage: node semantic-evaluate.mjs --dataset /private/sample/dataset.json --queries /private/queries.json --out /separate/report [--models /private/models] [--offline]')
const inside = (parent, child) => { const rel = relative(parent, child); return !rel || (!rel.startsWith('..') && !isAbsolute(rel)) }
async function canonical(path) { try { return await realpath(path) } catch (error) { if (error.code !== 'ENOENT') throw error; return join(await canonical(dirname(path)), basename(path)) } }
const datasetPath = await realpath(resolve(values.dataset)), input = dirname(datasetPath)
const out = await canonical(resolve(values.out)), models = await canonical(resolve(values.models ?? join(out, 'models')))
const repo = await realpath(new URL('../..', import.meta.url))
if (inside(input, out) || inside(out, input) || inside(input, models) || inside(models, input) || inside(repo, out) || inside(repo, models)) throw new Error('Keep input, output and model writes separate; output/models must be outside the repository')
const dataset = JSON.parse(await readFile(datasetPath, 'utf8')), queryFile = JSON.parse(await readFile(values.queries, 'utf8'))
if (dataset.version !== 1 || !Array.isArray(dataset.images) || !dataset.images.length || dataset.images.length > 100
  || dataset.images.some(image => typeof image.id !== 'string' || !/^[\w-]{1,100}$/.test(image.id) || typeof image.file !== 'string' || (image.originalName !== null && typeof image.originalName !== 'string') || typeof image.createdAt !== 'string' || !Number.isFinite(Date.parse(image.createdAt)) || image.hiddenFromGallery !== false || !/^[a-f0-9]{64}$/.test(image.sha256) || !Array.isArray(image.tags) || image.tags.some(tag => typeof tag.name !== 'string'))
  || new Set(dataset.images.map(image => image.id)).size !== dataset.images.length) throw new Error('Invalid visible-only dataset (1–100 unique images with SHA-256)')
const queries = queryFile.queries
if (queryFile.version !== 1 || !Array.isArray(queries) || !queries.length || queries.length > 100 || new Set(queries.map(query => query.id)).size !== queries.length
  || queries.some(query => typeof query.id !== 'string' || !/^[\w-]{1,100}$/.test(query.id) || typeof query.text !== 'string' || !query.text.trim() || query.text.length > 1000 || (query.tags !== undefined && (!Array.isArray(query.tags) || query.tags.some(tag => typeof tag !== 'string'))))) throw new Error('Invalid queries')
const paths = new Map()
for (const image of dataset.images) {
  if (isAbsolute(image.file)) throw new Error('Dataset paths must be relative')
  const path = await realpath(join(input, image.file))
  if (!inside(input, path) || digest(await readFile(path)) !== image.sha256) throw new Error('Dataset file escaped or changed')
  paths.set(image.id, path)
}
const datasetHash = digest(dataset), queriesHash = digest(queryFile)
const run = { fingerprint: semanticFingerprint, datasetHash, queriesHash }
await mkdir(out, { recursive: true }); await mkdir(models, { recursive: true })
try { const old = JSON.parse(await readFile(join(out, 'run.json'), 'utf8')); if (JSON.stringify(old) !== JSON.stringify(run)) throw new Error('Use a new output directory for another dataset, query set or model fingerprint') }
catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(join(out, 'run.json'), JSON.stringify(run, null, 2)) }
const cache = join(out, 'vectors'), thumbs = join(out, 'thumbs')
await mkdir(cache, { recursive: true }); await mkdir(thumbs, { recursive: true })
const metrics = { policy: semanticPolicy, ...run, offline: values.offline, startedAt: new Date().toISOString(),
  host: { name: hostname(), node: process.version, constrainedMemoryBytes: process.constrainedMemory(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem() },
  selectedImages: dataset.images.length, imageCacheHits: 0, textCacheHits: 0, visionLoadMs: 0, textLoadMs: 0, images: [], queries: [] }
const started = performance.now(), cpuStarted = process.cpuUsage()
let encoder, visionLoaded = false, textLoaded = false
const images = [], queryResults = []
const cacheRead = async (key, sourceHash) => {
  try { const value = JSON.parse(await readFile(join(cache, key + '.json'), 'utf8')); return validSemanticCache(value, sourceHash) ? value.vector : null } catch { return null }
}
const cacheWrite = async (key, sourceHash, vector) => {
  const path = join(cache, key + '.json'), temp = path + '.tmp'
  await writeFile(temp, JSON.stringify({ fingerprint: semanticFingerprint, sourceHash, vector })); await rename(temp, path)
}
async function directoryBytes(path) {
  let bytes = 0
  for (const item of await readdir(path, { withFileTypes: true })) { const child = join(path, item.name); bytes += item.isDirectory() ? await directoryBytes(child) : (await stat(child)).size }
  return bytes
}
try {
  for (const image of dataset.images) {
    const begin = performance.now(), key = 'image-' + digest(semanticFingerprint + image.sha256)
    let vector = await cacheRead(key, image.sha256)
    const cached = Boolean(vector)
    const bytes = await readFile(paths.get(image.id))
    if (digest(bytes) !== image.sha256) throw new Error('Dataset changed during evaluation')
    if (!vector) {
      if (!visionLoaded) { const start = performance.now(); encoder = await createSemanticEncoder(models, values.offline); await encoder.loadVision(); metrics.visionLoadMs = performance.now() - start; visionLoaded = true }
      vector = await encoder.image(bytes)
      await cacheWrite(key, image.sha256, vector)
    } else metrics.imageCacheHits++
    const thumbStart = performance.now()
    await sharp(bytes, { limitInputPixels: 40_000_000, pages: 1 }).rotate().resize(320, 320, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(thumbs, image.sha256 + '.webp'))
    metrics.images.push({ id: image.id, totalMs: performance.now() - begin, thumbnailMs: performance.now() - thumbStart, cached })
    images.push({ ...image, vector })
    console.log(`Image ${images.length}/${dataset.images.length}: ${cached ? 'cache' : 'encoded'}`)
  }
  await encoder?.disposeVision()
  for (const query of queries) {
    const begin = performance.now(), sourceHash = digest(query.text), key = 'text-' + digest(semanticFingerprint + sourceHash)
    let vector = await cacheRead(key, sourceHash), cached = Boolean(vector)
    if (!vector) {
      if (!textLoaded) { const start = performance.now(); encoder ??= await createSemanticEncoder(models, values.offline); await encoder.loadText(); metrics.textLoadMs = performance.now() - start; textLoaded = true }
      const infer = performance.now()
      vector = await encoder.text(query.text)
      metrics.queries.push({ id: query.id, inferenceMs: performance.now() - infer, cached: false })
      await cacheWrite(key, sourceHash, vector)
    } else { metrics.textCacheHits++; metrics.queries.push({ id: query.id, inferenceMs: 0, cached: true }) }
    const rankStart = performance.now(), semantic = rankSemantic(vector, images, query.tags), lexical = rankLexical(query.text, images, query.tags)
    Object.assign(metrics.queries.at(-1), { rankingMs: performance.now() - rankStart, totalMs: performance.now() - begin, lexicalMatches: lexical.length })
    const eligible = new Set(semantic.map(item => item.id))
    queryResults.push({ ...query, candidates: images.filter(image => eligible.has(image.id)).map(image => image.id), semantic, lexical })
  }
  const results = { version: 1, ...run, images: images.map(({ vector, file, ...image }) => image), queries: queryResults }
  metrics.modelCacheBytes = await directoryBytes(models)
  metrics.vectorCacheBytes = await directoryBytes(cache)
  metrics.totalMs = performance.now() - started
  metrics.peakRssMiB = process.resourceUsage().maxRSS / 1024
  await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2))
  await writeFile(join(out, 'index.html'), semanticReport(results, metrics))
  console.log(JSON.stringify({ selectedImages: images.length, queries: queries.length, imageCacheHits: metrics.imageCacheHits, textCacheHits: metrics.textCacheHits, visionLoadMs: metrics.visionLoadMs, textLoadMs: metrics.textLoadMs, totalMs: metrics.totalMs, peakRssMiB: metrics.peakRssMiB, modelCacheBytes: metrics.modelCacheBytes }))
} catch (error) {
  metrics.failed = true
  throw error
} finally {
  metrics.totalMs = performance.now() - started
  const cpu = process.cpuUsage(cpuStarted)
  metrics.cpuUserMs = cpu.user / 1000
  metrics.cpuSystemMs = cpu.system / 1000
  metrics.peakRssMiB = process.resourceUsage().maxRSS / 1024
  await writeFile(join(out, 'metrics.json'), JSON.stringify(metrics, null, 2))
  await encoder?.dispose()
}
