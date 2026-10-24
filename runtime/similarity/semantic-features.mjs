import { createHash } from 'node:crypto'
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

export const semanticModelFiles = ['config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/vision_model_quantized.onnx', 'onnx/text_model_quantized.onnx']
