export const descriptorVersion = 'dinov2-full-mean-q8-p65-s15-v1'

export function meanPatchEmbedding(tensor) {
  if (tensor.dims.length !== 3 || tensor.dims[0] !== 1 || tensor.dims[2] !== 384 || tensor.dims[1] < 2
    || tensor.data.length !== tensor.dims[1] * 384) throw new Error('Unexpected DINOv2 patch output')
  const mean = new Array(384).fill(0)
  for (let token = 1; token < tensor.dims[1]; token++) {
    for (let channel = 0; channel < 384; channel++) mean[channel] += tensor.data[token * 384 + channel] / (tensor.dims[1] - 1)
  }
  return normalize(mean)
}


export function normalize(vector) {
  const norm = Math.hypot(...vector)
  if (!norm || !Number.isFinite(norm) || vector.some(value => !Number.isFinite(value))) {
    throw new Error('Invalid visual descriptor')
  }
  return Array.from(vector, value => value / norm)
}


export function dot(a, b) {
  if (a.length !== b.length || !a.length) throw new Error('Incompatible descriptors')
  return a.reduce((sum, value, index) => sum + value * b[index], 0)
}

// Histogram preserves palette; a 4 × 4 grid preserves coarse color placement.

export function colorFeatures(rgb, width, height) {
  if (rgb.length !== width * height * 3 || width < 4 || height < 4) throw new Error('Invalid RGB image')
  const palette = new Array(64).fill(0)
  const spatial = new Array(48).fill(0)
  const counts = new Array(16).fill(0)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 3
    const r = rgb[offset], g = rgb[offset + 1], b = rgb[offset + 2]
    palette[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)]++
    const cell = Math.floor(y * 4 / height) * 4 + Math.floor(x * 4 / width)
    counts[cell]++
    for (let channel = 0; channel < 3; channel++) spatial[cell * 3 + channel] += rgb[offset + channel] / 255
  }
  for (let cell = 0; cell < 16; cell++) for (let channel = 0; channel < 3; channel++) {
    spatial[cell * 3 + channel] /= counts[cell]
  }
  // Square-root histogram yields a bounded palette affinity without dominant-bin squaring.
  return { palette: normalize(palette.map(value => Math.sqrt(value))), spatial }
}


export function validDescriptor(value) {
  return value && value.embedding?.length === 384 && value.palette?.length === 64 && value.spatial?.length === 48
    && [...value.embedding, ...value.palette, ...value.spatial].every(Number.isFinite)
}

export function visualSimilarity(a, b) {
  const embedding = dot(a.embedding, b.embedding)
  const palette = dot(a.palette, b.palette)
  const layout = 1 - Math.sqrt(a.spatial.reduce((sum, value, i) => sum + (value - b.spatial[i]) ** 2, 0) / a.spatial.length)
  return 0.20 * embedding + 0.65 * palette + 0.15 * layout
}
