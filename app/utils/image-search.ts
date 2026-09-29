export const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, ' ')

export const matchesImageSearch = (
  image: { originalName: string | null; tags: { name: string }[] },
  query: string,
) => {
  const terms = normalizeSearch(query).split(' ').filter(Boolean)
  const fields = [image.originalName ?? '', ...image.tags.map((tag) => tag.name)].map(normalizeSearch)
  return terms.every((term) => fields.some((field) => field.includes(term)))
}
