import { createHash } from 'node:crypto'
export const duplicatePolicy = {
  model: 'immich-app/ViT-B-16-SigLIP2__webli', revision: '81999505043a05dbc3ff4c6ba9932d93a15216a4', dimensions: 768,
  preprocessing: 'bicubic-a-0.5-aa-fixed22-squash224;sharp-exif-first-frame-srgb-drop-alpha;40MP;uint8-nhwc-v1', runtime: 'onnxruntime-node-1.30.0',
}
export const duplicateDigest = value => createHash('sha256').update(typeof value === 'string' || ArrayBuffer.isView(value) ? value : JSON.stringify(value)).digest('hex')
export const duplicateFingerprint = duplicateDigest(duplicatePolicy)
export function duplicateVector(value) {
  const values = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(values) || values.length !== 768 || values.some(x => typeof x !== 'number' || !Number.isFinite(x))) throw new Error('Invalid duplicate vector')
  const norm = Math.hypot(...values)
  if (!norm || !Number.isFinite(norm)) throw new Error('Invalid duplicate vector')
  return values.map(x => x / norm)
}
export function duplicatePairs(images) {
  const vectors = images.map(image => Float32Array.from(duplicateVector(image.vector)))
  const pairs = []
  for (let i = 0; i < images.length; i++) for (let j = i + 1; j < images.length; j++) {
    let dot = 0
    for (let k = 0; k < 768; k++) dot += vectors[i][k] * vectors[j][k]
    const distance = Math.max(0, 1 - dot)
    if (distance <= .1) pairs.push({ a: images[i].id, b: images[j].id, distance })
  }
  return pairs.sort((a, b) => a.distance - b.distance || a.a.localeCompare(b.a) || a.b.localeCompare(b.b))
}
export function duplicateComponents(pairs, maximum = .03) {
  const edges = new Map()
  for (const pair of pairs) if (pair.distance <= maximum) {
    if (!edges.has(pair.a)) edges.set(pair.a, new Set())
    if (!edges.has(pair.b)) edges.set(pair.b, new Set())
    edges.get(pair.a).add(pair.b); edges.get(pair.b).add(pair.a)
  }
  const seen = new Set(), groups = []
  for (const id of [...edges.keys()].sort()) {
    if (seen.has(id)) continue
    const stack = [id], group = []
    while (stack.length) {
      const next = stack.pop()
      if (seen.has(next)) continue
      seen.add(next); group.push(next)
      for (const neighbor of edges.get(next)) if (!seen.has(neighbor)) stack.push(neighbor)
    }
    groups.push(group.sort())
  }
  return groups
}
