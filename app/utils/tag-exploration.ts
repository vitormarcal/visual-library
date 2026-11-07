import { normalizeSearch } from './image-search.ts'

type Tag = { id: string; name: string; normalizedName: string }
type Image = { id: string; src: string; tags: Tag[]; createdAt?: string }
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
    .map(({ tag, images: members }) => {
      const cover = members.find(image => image.id === coverIds.get(tag.id)) ?? null
      const ordered = [...members].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
      const primary = cover ?? ordered[0]
      return {
        ...tag, imageCount: members.length, cover,
        previews: primary ? [primary, ...ordered.filter(image => image.id !== primary.id)].slice(0, 3) : [],
      }
    })
}

// Folders currently derive their contents from one tag. No parallel membership list.
export const automaticTagFolders = <T extends Image & { hiddenFromGallery?: boolean; createdAt?: string }>(images: T[], covers: TagCover[], query = '') =>
  groupImagesByTag(images.filter(image => !image.hiddenFromGallery), covers, query)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

// This only compacts the directory. Each folder keeps its identity and tag scope.
export const sharedSingleImageFolderCards = <T extends { id: string; name: string; imageCount: number; previews: { id: string }[] }>(folders: T[]) => {
  const cards = new Map<string, { key: string; folders: T[]; previews: T['previews'] }>()
  for (const folder of [...folders].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))) {
    const onlyImage = folder.imageCount === 1 && folder.previews.length === 1 ? folder.previews[0] : null
    const key = onlyImage ? `image:${onlyImage.id}` : `folder:${folder.id}`
    const existing = cards.get(key)
    if (existing) existing.folders.push(folder)
    else cards.set(key, { key, folders: [folder], previews: folder.previews })
  }
  return [...cards.values()]
}
