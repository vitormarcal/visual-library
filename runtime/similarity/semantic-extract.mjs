import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { semanticPolicy, normalizedVector, semanticModelFiles } from './semantic-features.mjs'

export async function createSemanticEncoder(models, offline = false) {
  const { env, AutoProcessor, AutoTokenizer, SiglipVisionModel, SiglipTextModel, RawImage } = await import('@huggingface/transformers')
  env.cacheDir = models
  const local = join(models, semanticPolicy.model, semanticPolicy.revision)
  offline = offline || semanticModelFiles.every(file => existsSync(join(local, file)))
  env.allowRemoteModels = !offline
  const source = offline ? join(models, semanticPolicy.model, semanticPolicy.revision) : semanticPolicy.model
  const options = { revision: semanticPolicy.revision, dtype: semanticPolicy.dtype, device: 'cpu', local_files_only: offline,
    session_options: { intraOpNumThreads: 2, interOpNumThreads: 1, executionMode: 'sequential' } }
  let vision, processor, textModel, tokenizer
  sharp.concurrency(1)
  sharp.cache({ memory: 32, files: 0, items: 20 })
  return {
    async loadVision() {
      processor = await AutoProcessor.from_pretrained(source, options)
      vision = await SiglipVisionModel.from_pretrained(source, options)
    },
    async image(bytes) {
      const decoded = await sharp(bytes, { limitInputPixels: 40_000_000, pages: 1, failOn: 'warning' }).rotate().flatten({ background: '#fff' })
        .toColourspace('srgb').removeAlpha().resize(448, 448, { fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true })
      const inputs = await processor(new RawImage(new Uint8ClampedArray(decoded.data), decoded.info.width, decoded.info.height, 3))
      const output = await vision(inputs)
      return normalizedVector(output.pooler_output.data)
    },
    async disposeVision() { await vision?.dispose(); vision = null; processor = null },
    async loadText() {
      tokenizer = await AutoTokenizer.from_pretrained(source, options)
      textModel = await SiglipTextModel.from_pretrained(source, options)
    },
    async text(query) {
      const inputs = await tokenizer(query, { padding: 'max_length', max_length: 64, truncation: true })
      return normalizedVector((await textModel(inputs)).pooler_output.data)
    },
    async dispose() {
      const oldVision = vision, oldText = textModel
      vision = null; processor = null; textModel = null; tokenizer = null
      await oldVision?.dispose(); await oldText?.dispose()
    },
  }
}
