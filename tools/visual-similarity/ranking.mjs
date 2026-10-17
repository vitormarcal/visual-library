export const methodVersion = 'dinov2-small-q8-cls-rgb-hist-spatial-v1'
export const variantVersion = 'dinov2-small-q8-mean-full-frame-variants-v2'

export const comparisonMethods = {
  palette: { label: 'Paleta isolada · referência', description: 'Mesmo histograma e ranking do primeiro teste.' },
  embedding: { label: 'Embedding original · vetor global', description: 'Vetor CLS, recorte central. Controle do primeiro teste.', field: 'embedding' },
  mean: { label: 'Embedding · média das regiões', description: 'Média dos patches, sem CLS, com o mesmo recorte central.', field: 'meanEmbedding' },
  full: { label: 'Embedding · imagem inteira', description: 'Média dos patches sem recorte central. Imagem ajustada a 224 × 224; altera as proporções.', field: 'fullEmbedding' },
  combined: { label: 'Combinação original · 65/20/15', description: '65% embedding CLS original, 20% paleta, 15% posição das cores.', field: 'embedding', weights: [0.65, 0.20, 0.15] },
  colorCls: { label: 'Combinação · paleta 65% + global', description: '20% embedding CLS original, 65% paleta, 15% posição das cores.', field: 'embedding', weights: [0.20, 0.65, 0.15] },
  balancedFull: { label: 'Combinação · paleta 45% + imagem inteira', description: '40% embedding médio da imagem inteira, 45% paleta, 15% posição das cores.', field: 'fullEmbedding', weights: [0.40, 0.45, 0.15] },
  colorFull: { label: 'Combinação · paleta 65% + imagem inteira', description: '20% embedding médio da imagem inteira, 65% paleta, 15% posição das cores.', field: 'fullEmbedding', weights: [0.20, 0.65, 0.15] },
}

export function meanPatchEmbedding(tensor) {
  if (tensor.dims.length !== 3 || tensor.dims[0] !== 1 || tensor.dims[2] !== 384 || tensor.dims[1] < 2
    || tensor.data.length !== tensor.dims[1] * 384) throw new Error('Unexpected DINOv2 patch output')
  const mean = new Array(384).fill(0)
  for (let token = 1; token < tensor.dims[1]; token++) {
    for (let channel = 0; channel < 384; channel++) mean[channel] += tensor.data[token * 384 + channel] / (tensor.dims[1] - 1)
  }
  return normalize(mean)
}

export function clsEmbedding(tensor) {
  if (tensor.dims.length !== 3 || tensor.dims[0] !== 1 || tensor.dims[2] !== 384 || tensor.data.length < 384) {
    throw new Error('Unexpected DINOv2 output')
  }
  // DINOv2 exports token features; the first token summarizes the image.
  return normalize(Array.from(tensor.data.slice(0, 384)))
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

export function similarity(a, b, method = 'combined') {
  const config = comparisonMethods[method]
  if (!config) throw new Error('Unknown comparison method')
  const palette = dot(a.palette, b.palette)
  if (method === 'palette') return palette
  const visual = dot(a[config.field], b[config.field])
  if (!config.weights) return visual
  const layout = 1 - Math.sqrt(a.spatial.reduce((sum, value, i) => sum + (value - b.spatial[i]) ** 2, 0) / a.spatial.length)
  // Experimental weights, to be judged visually before any product integration.
  return config.weights[0] * visual + config.weights[1] * palette + config.weights[2] * layout
}

export function rank(reference, candidates, method, limit = 12) {
  return candidates.filter(candidate => candidate.id !== reference.id)
    .map(candidate => ({ id: candidate.id, score: similarity(reference, candidate, method) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en'))
    .slice(0, limit)
}

export function sampleEvenly(items, count) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid sample size')
  if (items.length <= count) return [...items]
  if (count === 1) return [items[0]]
  return Array.from({ length: count }, (_, index) => items[Math.round(index * (items.length - 1) / (count - 1))])
}
