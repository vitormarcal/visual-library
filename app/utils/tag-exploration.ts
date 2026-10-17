import { normalizeSearch } from './image-search.ts'

type Tag = { id: string; name: string; normalizedName: string }
type Image = { id: string; src: string; tags: Tag[] }
export type TagCover = Tag & { coverImageId: string | null }

export const groupImagesByTag = <T extends Image>(images: T[], covers: TagCover[], query = '') => {
  const groups = new Map<string, { tag: Tag; images: T[] }>()
  for (const image of images) {
    for (const tag of new Map(image.tags.map((tag) => [tag.id, tag])).values()) {
      const group = groups.get(tag.id) ?? { tag, images: [] }
      if (!group.images.some((candidate) => candidate.id === image.id)) group.images.push(image)
      groups.set(tag.id, group)
    }
  }
  const coverIds = new Map(covers.map((tag) => [tag.id, tag.coverImageId]))
  const terms = normalizeSearch(query).split(' ').filter(Boolean)
  return [...groups.values()]
    .filter(({ tag }) => terms.every((term) => normalizeSearch(tag.name).includes(term)))
    .sort((a, b) => b.images.length - a.images.length || a.tag.name.localeCompare(b.tag.name) || a.tag.id.localeCompare(b.tag.id))
    .map(({ tag, images: members }) => ({
      ...tag, imageCount: members.length,
      cover: members.find((image) => image.id === coverIds.get(tag.id)) ?? null,
    }))
}

// Weighted daily shuffle: larger subjects are favored without excluding small ones.
export const orderExploreGroups = <T extends { id: string; imageCount: number }>(groups: T[], day: string): T[] => {
  const score = (group: T) => {
    let hash = 2166136261
    for (const character of `${day}:${group.id}`) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
    }
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
    const random = (((hash ^ (hash >>> 16)) >>> 0) + 1) / 4294967297
    return -Math.log(random) / Math.sqrt(Math.max(1, group.imageCount))
  }
  return groups.map(group => ({ group, score: score(group) }))
    .sort((a, b) => a.score - b.score || a.group.id.localeCompare(b.group.id))
    .map(({ group }) => group)
}
