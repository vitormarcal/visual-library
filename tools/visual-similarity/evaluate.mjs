import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, realpath, rename } from 'node:fs/promises'
import { basename, dirname, join, resolve, relative, isAbsolute } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseArgs } from 'node:util'
import { performance } from 'node:perf_hooks'
import sharp from 'sharp'
import { methodVersion, variantVersion, comparisonMethods, colorFeatures, clsEmbedding, meanPatchEmbedding, rank, sampleEvenly } from './ranking.mjs'
import { createReport } from './report.mjs'

const { values } = parseArgs({ options: {
  data: { type: 'string' }, out: { type: 'string' },
  limit: { type: 'string', default: '100' }, references: { type: 'string', default: '20' },
  variants: { type: 'boolean', default: false }, baseline: { type: 'string' },
  offline: { type: 'boolean', default: false },
} })
if (!values.data || !values.out) throw new Error('Usage: node evaluate.mjs --data /path/to/data --out /separate/output [--limit 100 --references 20] [--variants --baseline /original/results.json] [--offline]')
const limit = Number(values.limit), referenceCount = Number(values.references)
if (!Number.isSafeInteger(limit) || limit < 2 || limit > 1000 || !Number.isSafeInteger(referenceCount) || referenceCount < 1 || referenceCount > 100) {
  throw new Error('Use limit 2–1000 and references 1–100')
}
const dataDir = await realpath(resolve(values.data))
async function canonicalOutput(path) {
  try { return await realpath(path) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    return join(await canonicalOutput(dirname(path)), basename(path))
  }
}
const outputDir = await canonicalOutput(resolve(values.out))
const inside = (parent, child) => { const path = relative(parent, child); return !path || (!path.startsWith('..') && !isAbsolute(path)) }
if (inside(dataDir, outputDir) || inside(outputDir, dataDir)) throw new Error('Output and input must be separate directories')
await mkdir(outputDir, { recursive: true })
const imageDir = await realpath(join(dataDir, 'images'))
const thumbsDir = join(outputDir, 'thumbs'), cacheDir = join(outputDir, 'descriptors')
await mkdir(thumbsDir, { recursive: true }); await mkdir(cacheDir, { recursive: true })
sharp.concurrency(1)
sharp.cache({ memory: 32, files: 0, items: 20 })

const model = 'Xenova/dinov2-small'
const revision = 'c2bb04a51fab207c420665f1946016107bffc701'
const descriptorVersion = values.variants ? variantVersion : methodVersion
const baseline = values.baseline ? JSON.parse(await readFile(resolve(values.baseline), 'utf8')) : null
if (baseline && (!Array.isArray(baseline.images) || !Array.isArray(baseline.references) || !baseline.images.length
  || new Set(baseline.images.map(image => image.id)).size !== baseline.images.length
  || baseline.references.some(ref => !baseline.images.some(image => image.id === ref.id)))) throw new Error('Invalid baseline report')
const started = performance.now()
const metrics = {
  methodVersion: descriptorVersion, model, revision, dtype: 'q8', threads: 2,
  variants: values.variants, fixedBaseline: Boolean(baseline),
  methods: values.variants ? comparisonMethods : undefined,
  startedAt: new Date().toISOString(), visibleImages: 0, selectedImages: 0,
  processedImages: 0, cachedImages: 0, failedImages: [],
  modelLoadMs: 0, processingMs: 0, queryMs: 0, peakRssMiB: 0, totalMs: 0,
  images: [],
}
// Never initialize the application datastore: this connection cannot migrate/write.
const db = new DatabaseSync(join(dataDir, 'library.sqlite'), { readOnly: true })
let selected
try {
  const rows = db.prepare(`SELECT id, filename, original_name FROM images
    WHERE hidden_from_gallery = 0 ORDER BY created_at ASC, id ASC`).all()
  metrics.visibleImages = rows.length
  if (baseline) {
    const byId = new Map(rows.map(row => [row.id, row]))
    if (baseline.images.some(image => !byId.has(image.id))) throw new Error('A baseline image is missing or hidden; comparison cannot silently change the sample')
    selected = baseline.images.map(image => ({ ...byId.get(image.id), baselineKey: image.key }))
  } else selected = sampleEvenly(rows, limit)
  metrics.selectedImages = selected.length
} finally { db.close() }

let extractor, fullProcessor, RawImageClass, modelLoadFailed = false
async function embedding(data, width, height) {
  if (!extractor) {
    const begin = performance.now()
    const { pipeline, env, RawImage } = await import('@huggingface/transformers')
    env.cacheDir = join(outputDir, 'models')
    if (values.offline) env.allowRemoteModels = false
    RawImageClass = RawImage
    try {
      extractor = await pipeline('image-feature-extraction', values.offline ? join(env.cacheDir, model, revision) : model, {
        revision, dtype: 'q8', device: 'cpu', local_files_only: values.offline,
        session_options: { intraOpNumThreads: 2, interOpNumThreads: 1, executionMode: 'sequential' },
      })
    } catch (error) { modelLoadFailed = true; throw error }
    metrics.modelLoadMs = Math.round(performance.now() - begin)
  }
  const result = await extractor(new RawImageClass(new Uint8ClampedArray(data), width, height, 3), { pool: false })
  const features = { embedding: clsEmbedding(result) }
  if (values.variants) {
    features.meanEmbedding = meanPatchEmbedding(result)
    // Separate processor keeps the original path exactly unchanged for controls.
    fullProcessor ??= new extractor.processor.image_processor.constructor({ ...extractor.processor.image_processor, do_resize: false, do_center_crop: false })
    const full = await sharp(data, { raw: { width, height, channels: 3 } }).resize(224, 224, { fit: 'fill' }).raw().toBuffer()
    const { pixel_values } = await fullProcessor(new RawImageClass(new Uint8ClampedArray(full), 224, 224, 3))
    const output = await extractor.model({ pixel_values })
    features.fullEmbedding = meanPatchEmbedding(output.last_hidden_state)
  }
  return features
}

function validCache(value, key) {
  return value?.key === key && value.embedding?.length === 384 && value.palette?.length === 64 && value.spatial?.length === 48
    && [...value.embedding, ...value.palette, ...value.spatial].every(Number.isFinite)
    && (!values.variants || (value.meanEmbedding?.length === 384 && value.fullEmbedding?.length === 384
      && [...value.meanEmbedding, ...value.fullEmbedding].every(Number.isFinite)))
}
const results = []
for (const [index, row] of selected.entries()) {
  const begin = performance.now()
  try {
    if (!row.filename || basename(row.filename) !== row.filename) throw new Error('invalid-filename')
    const filePath = await realpath(join(imageDir, row.filename))
    if (!inside(imageDir, filePath)) throw new Error('invalid-file-location')
    const bytes = await readFile(filePath)
    if (row.baselineKey && row.baselineKey !== createHash('sha256').update(methodVersion).update(revision).update(bytes).digest('hex')) {
      throw new Error('baseline-image-changed')
    }
    const key = createHash('sha256').update(descriptorVersion).update(revision).update(bytes).digest('hex')
    let descriptor
    try { descriptor = JSON.parse(await readFile(join(cacheDir, key + '.json'), 'utf8')) } catch { /* Missing or incomplete cache: regenerate. */ }
    const cached = validCache(descriptor, key)
    // Decode one frame, apply EXIF orientation and cap decompression at 40 MP.
    const rgb = await sharp(bytes, { limitInputPixels: 40_000_000, pages: 1, failOn: 'warning' })
      .rotate().flatten({ background: '#ffffff' }).toColourspace('srgb').removeAlpha()
      .resize(448, 448, { fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true })
    if (!cached) {
      const colors = await sharp(rgb.data, { raw: rgb.info }).resize(32, 32, { fit: 'fill' }).raw().toBuffer()
      descriptor = { key, ...await embedding(rgb.data, rgb.info.width, rgb.info.height), ...colorFeatures(colors, 32, 32) }
      if (!validCache(descriptor, key)) throw new Error('invalid-descriptor')
      const temp = join(cacheDir, key + '.tmp')
      await writeFile(temp, JSON.stringify(descriptor)); await rename(temp, join(cacheDir, key + '.json'))
      metrics.processedImages++
    } else metrics.cachedImages++
    await sharp(rgb.data, { raw: rgb.info }).resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 }).toFile(join(thumbsDir, key + '.jpg'))
    results.push({ ...descriptor, id: row.id, name: row.original_name || 'Saved image', width: rgb.info.width, height: rgb.info.height })
    const ms = Math.round(performance.now() - begin)
    metrics.images.push({ id: row.id, ms, cached })
    console.log(`${index + 1}/${selected.length} ${cached ? 'cache' : 'processed'} ${ms}ms`)
  } catch (error) {
    // Report stable error classes, never server paths or arbitrary decoder messages.
    const reason = ['invalid-filename', 'invalid-file-location', 'invalid-descriptor', 'baseline-image-changed'].includes(error.message) ? error.message
      : error.code === 'ENOENT' ? 'file-unavailable' : 'decode-or-inference-failed'
    metrics.failedImages.push({ id: row.id, reason })
    console.error(`${index + 1}/${selected.length} failed: ${reason}`)
    // A model load failure affects the whole experiment; don't repeat 100 network downloads.
    if (metrics.failedImages.length === 1) console.error(String(error.message).replaceAll(dataDir, '[input]').replaceAll(outputDir, '[output]'))
    if (modelLoadFailed) break
  }
}
metrics.processingMs = Math.round(performance.now() - started - metrics.modelLoadMs)
const queryStart = performance.now()
const methods = values.variants ? Object.keys(comparisonMethods) : ['combined', 'embedding', 'palette']
const byId = new Map(results.map(result => [result.id, result]))
const referenceImages = baseline ? baseline.references.map(ref => byId.get(ref.id)).filter(Boolean) : sampleEvenly(results, referenceCount)
const references = referenceImages.map(reference => ({
  id: reference.id,
  rankings: Object.fromEntries(methods.map(method => [method, rank(reference, results, method)])),
}))
if (baseline) {
  metrics.controls = Object.fromEntries(['palette', 'embedding', 'combined'].map(method => [method, {
    identicalReferences: references.filter(ref => JSON.stringify(ref.rankings[method].map(item => item.id)) === JSON.stringify(baseline.references.find(old => old.id === ref.id)?.rankings[method]?.map(item => item.id))).length,
    totalReferences: baseline.references.length,
  }]))
}
metrics.queryMs = +(performance.now() - queryStart).toFixed(2)
metrics.peakRssMiB = +(process.resourceUsage().maxRSS / 1024).toFixed(1)
metrics.totalMs = Math.round(performance.now() - started)
await writeFile(join(outputDir, 'metrics.json'), JSON.stringify(metrics, null, 2))
await writeFile(join(outputDir, 'results.json'), JSON.stringify({ images: results.map(({ embedding, meanEmbedding, fullEmbedding, palette, spatial, ...image }) => image), references }, null, 2))
await writeFile(join(outputDir, 'index.html'), createReport(results, references, metrics))
await extractor?.dispose()
console.log(JSON.stringify({ ...metrics, images: undefined }, null, 2))
if (results.length < 2 || metrics.failedImages.length) process.exitCode = 1
if (baseline && Object.values(metrics.controls).some(control => control.identicalReferences !== control.totalReferences)) process.exitCode = 1
