type TaggedImage = { id: string; tags: { normalizedName: string }[] }

export const sharedTagCaption = (
  image: { tags: { name: string; normalizedName: string }[] }, candidate: TaggedImage,
) => {
  const candidateTags = new Set(candidate.tags.map((tag) => tag.normalizedName))
  const shared = image.tags.filter((tag, index, tags) => candidateTags.has(tag.normalizedName)
    && tags.findIndex((other) => other.normalizedName === tag.normalizedName) === index)
  if (!shared.length) return ''
  return `Shared tag: ${shared[0]!.name}${shared.length > 1 ? ` (+${shared.length - 1})` : ''}`
}

export const findRelatedImages = <T extends TaggedImage>(image: TaggedImage, candidates: T[]): T[] => {
  const tags = new Set(image.tags.map((tag) => tag.normalizedName))
  const seen = new Set([image.id])
  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.id)) return false
      seen.add(candidate.id)
      return true
    })
    .map((candidate, order) => ({
      candidate, order,
      shared: [...new Set(candidate.tags.map((tag) => tag.normalizedName))].filter((tag) => tags.has(tag)).length,
    }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || a.order - b.order)
    .slice(0, 6)
    .map(({ candidate }) => candidate)
}
