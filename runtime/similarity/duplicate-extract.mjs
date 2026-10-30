import sharp from 'sharp'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import { mkdir, readFile, rename, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { duplicateDigest, duplicatePolicy, duplicateVector } from './duplicate-features.mjs'
import { duplicateResize } from './duplicate-resize.mjs'

const files = {
  'model.onnx': '896c732bf4aa73cb5c655e18130d4b8280a91ebc6a6ab534da25101ae5700bd1',
  'model.safetensors': '8e3c06eeed62b02abc94b097e8ef8cb0c4e36683a66fbd11506113e5b1b15e4a',
}
export async function createDuplicateEncoder(directory) {
  await mkdir(directory, { recursive: true })
  for (const [name, hash] of Object.entries(files)) {
    const path = join(directory, name)
    try { if (duplicateDigest(await readFile(path)) === hash) continue } catch {}
    const temp = path + '.partial'
    try {
      const response = await fetch(`https://huggingface.co/${duplicatePolicy.model}/resolve/${duplicatePolicy.revision}/visual/${name}`, { signal: AbortSignal.timeout(600_000) })
      if (!response.ok || !response.body) throw new Error('Duplicate model unavailable')
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temp, { mode: 0o600 }))
      if (duplicateDigest(await readFile(temp)) !== hash) throw new Error('Duplicate model integrity mismatch')
      await rename(temp, path)
    } finally { await rm(temp, { force: true }).catch(() => {}) }
  }
  const session = await InferenceSession.create(join(directory, 'model.onnx'), {
    executionProviders: ['cpu'], intraOpNumThreads: 2, interOpNumThreads: 1, executionMode: 'sequential',
  })
  sharp.concurrency(1); sharp.cache({ memory: 32, files: 0, items: 20 })
  return {
    async image(bytes) {
      const decoded = await sharp(bytes, { limitInputPixels: 40_000_000, pages: 1, failOn: 'warning' }).rotate()
        .toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const buffer = duplicateResize(decoded.data, decoded.info.width, decoded.info.height)
      const result = await session.run({ image: new Tensor('uint8', buffer, [1, 224, 224, 3]) })
      return duplicateVector(Array.from(result.image_embedding.data))
    },
    dispose: () => session.release(),
  }
}
