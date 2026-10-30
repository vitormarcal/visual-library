import type { ImageRecord } from '../types/image'
export type DuplicateImage = ImageRecord & { publicLinkCount: number; integrationReferenceCount: number }
export type DuplicateGroup = { id: string; revision: string; images: DuplicateImage[] }
export type DuplicateReviewResponse = {
  state: 'inactive' | 'preparing' | 'ready' | 'unavailable'
  groups: DuplicateGroup[]; totalCount: number; preparedCount: number; failedCount: number; pendingCount: number
}
export function suggestedDuplicateKeeps(images: DuplicateImage[], broad = false): string[] {
  if (broad) return images.map(image => image.id)
  const valid = images.filter(image => image.width && image.height)
  if (valid.length !== images.length) return images.map(image => image.id)
  const ordered = [...images].sort((a, b) => b.width! * b.height! - a.width! * a.height! || b.sizeBytes - a.sizeBytes || a.id.localeCompare(b.id))
  const best = ordered[0]
  if (!best) return []
  const ratio = best.width! / best.height!
  return ordered.filter(image => image.integrationReferenceCount || Math.abs(image.width! / image.height! / ratio - 1) > .03
    || image.width! * image.height! === best.width! * best.height! && image.sizeBytes === best.sizeBytes).map(image => image.id)
}
export function duplicateSuggestionReason(image: DuplicateImage, images: DuplicateImage[]) {
  if (image.integrationReferenceCount) return 'Used by an integration'
  if (!image.width || !image.height || images.some(item => !item.width || !item.height)) return 'Compare before removing'
  const best = [...images].sort((a, b) => b.width! * b.height! - a.width! * a.height! || b.sizeBytes - a.sizeBytes)[0]!
  if (Math.abs(image.width / image.height / (best.width! / best.height!) - 1) > .03) return 'Different crop · compare'
  const pixels = image.width * image.height, bestPixels = best.width! * best.height!
  if (pixels < bestPixels) return 'Lower resolution'
  if (images.filter(item => item.width! * item.height! === bestPixels).length === 1) return 'Higher resolution'
  if (image.sizeBytes < best.sizeBytes) return 'Same resolution · smaller file'
  if (images.filter(item => item.width! * item.height! === bestPixels && item.sizeBytes === image.sizeBytes).length > 1) return 'Compare before removing'
  return 'Same resolution · larger file'
}
