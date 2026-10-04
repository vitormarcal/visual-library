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
    .sort((a, b) => a.tag.name.localeCompare(b.tag.name) || a.tag.id.localeCompare(b.tag.id))
    .map(({ tag, images: members }) => ({
      ...tag, imageCount: members.length,
      cover: members.find((image) => image.id === coverIds.get(tag.id)) ?? null,
    }))
}
