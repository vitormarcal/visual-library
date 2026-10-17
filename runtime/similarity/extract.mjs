import { existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { colorFeatures, meanPatchEmbedding, validDescriptor } from './features.mjs'

const model = 'Xenova/dinov2-small'
const revision = 'c2bb04a51fab207c420665f1946016107bffc701'
let extractor, processor, RawImageClass
sharp.concurrency(1)
sharp.cache({ memory: 32, files: 0, items: 20 })
export class ModelUnavailableError extends Error {}

export async function extractDescriptor(bytes, cacheDir) {
  const rgb = await sharp(bytes, { limitInputPixels: 40_000_000, pages: 1, failOn: 'warning' })
    .rotate().flatten({ background: '#ffffff' }).toColourspace('srgb').removeAlpha()
    .resize(448, 448, { fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true })
  const colors = await sharp(rgb.data, { raw: rgb.info }).resize(32, 32, { fit: 'fill' }).raw().toBuffer()
  if (!extractor) {
    try {
      const { pipeline, env, RawImage } = await import('@huggingface/transformers')
      env.cacheDir = cacheDir
      RawImageClass = RawImage
      const local = join(cacheDir, model, revision)
      const offline = ['config.json', 'preprocessor_config.json', 'onnx/model_quantized.onnx'].every(file => existsSync(join(local, file)))
      env.allowRemoteModels = !offline
      extractor = await pipeline('image-feature-extraction', offline ? local : model, {
        revision, dtype: 'q8', device: 'cpu', local_files_only: offline,
        session_options: { intraOpNumThreads: 2, interOpNumThreads: 1, executionMode: 'sequential' },
      })
      processor = new extractor.processor.image_processor.constructor({ ...extractor.processor.image_processor, do_resize: false, do_center_crop: false })
    } catch { throw new ModelUnavailableError('Could not load the visual model') }
  }
  const full = await sharp(rgb.data, { raw: rgb.info }).resize(224, 224, { fit: 'fill' }).raw().toBuffer()
  const { pixel_values } = await processor(new RawImageClass(new Uint8ClampedArray(full), 224, 224, 3))
  const output = await extractor.model({ pixel_values })
  const descriptor = { embedding: meanPatchEmbedding(output.last_hidden_state), ...colorFeatures(colors, 32, 32) }
  if (!validDescriptor(descriptor)) throw new Error('Invalid visual descriptor')
  return descriptor
}

export async function disposeExtractor() { await extractor?.dispose() }
