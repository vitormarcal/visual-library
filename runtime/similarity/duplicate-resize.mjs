// Separable RGB bicubic resampling (A=-0.5), with antialiasing and 22-bit
// coefficient rounding to match the Pillow preprocessing used by Immich.
// Reference: https://github.com/python-pillow/Pillow/blob/10.2.0/src/libImaging/Resample.c
const precision = 2 ** 22
function cubic(value) {
  const x = Math.abs(value)
  return x < 1 ? ((1.5 * x - 2.5) * x) * x + 1 : x < 2 ? -.5 * (((x - 5) * x + 8) * x - 4) : 0
}
function coefficients(size, output) {
  const scale = size / output, filterScale = Math.max(1, scale), support = 2 * filterScale
  return Array.from({ length: output }, (_, index) => {
    const center = (index + .5) * scale
    const start = Math.max(0, Math.trunc(center - support + .5)), end = Math.min(size, Math.trunc(center + support + .5))
    const weights = Array.from({ length: end - start }, (_, offset) => cubic((start + offset - center + .5) / filterScale))
    const total = weights.reduce((sum, value) => sum + value, 0)
    return { start, weights: Int32Array.from(weights, weight => { const scaled = weight / total * precision; return Math.trunc(scaled + (scaled < 0 ? -.5 : .5)) }) }
  })
}
const byte = value => Math.max(0, Math.min(255, Math.floor(value / precision)))
export function duplicateResize(rgb, width, height, output = 224) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width > 100_000 || height > 100_000 || rgb.length !== width * height * 3
    || output * height * 3 > 128 * 1024 * 1024) throw new Error('Unsupported image dimensions')
  let horizontal = rgb
  if (width !== output) {
    horizontal = new Uint8Array(output * height * 3)
    const columns = coefficients(width, output)
    for (let y = 0; y < height; y++) for (let x = 0; x < output; x++) {
      const { start, weights } = columns[x]
      let r = precision / 2, g = r, b = r
      for (let k = 0; k < weights.length; k++) {
        const at = (y * width + start + k) * 3, weight = weights[k]
        r += rgb[at] * weight; g += rgb[at + 1] * weight; b += rgb[at + 2] * weight
      }
      const at = (y * output + x) * 3
      horizontal[at] = byte(r); horizontal[at + 1] = byte(g); horizontal[at + 2] = byte(b)
    }
  }
  if (height === output) return horizontal
  const resized = new Uint8Array(output * output * 3), rows = coefficients(height, output)
  for (let y = 0; y < output; y++) for (let x = 0; x < output; x++) {
    const { start, weights } = rows[y]
    let r = precision / 2, g = r, b = r
    for (let k = 0; k < weights.length; k++) {
      const at = ((start + k) * output + x) * 3, weight = weights[k]
      r += horizontal[at] * weight; g += horizontal[at + 1] * weight; b += horizontal[at + 2] * weight
    }
    const at = (y * output + x) * 3
    resized[at] = byte(r); resized[at + 1] = byte(g); resized[at + 2] = byte(b)
  }
  return resized
}
