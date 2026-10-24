type Candidate = { id: string; createdAt: string; hiddenFromGallery: boolean }
export type RediscoverySelection = { ids: string[]; includesRecent: boolean }
const batchSize = 8
const minimumAge = 30 * 24 * 60 * 60 * 1000

export function selectRediscovery(images: Candidate[], previous: string[] = [], now = Date.now(), random = Math.random): RediscoverySelection {
  const unique = [...new Map(images.filter(image => !image.hiddenFromGallery).map(image => [image.id, image])).values()]
  const excluded = new Set(previous)
  const old = (image: Candidate) => Number.isFinite(Date.parse(image.createdAt)) && Date.parse(image.createdAt) <= now - minimumAge
  const shuffle = <T>(values: T[]) => {
    const result = [...values]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }
  const groups = [
    unique.filter(image => old(image) && !excluded.has(image.id)),
    unique.filter(image => !old(image) && !excluded.has(image.id)),
    unique.filter(image => old(image) && excluded.has(image.id)),
    unique.filter(image => !old(image) && excluded.has(image.id)),
  ]
  const selected = groups.flatMap(shuffle).slice(0, batchSize)
  return { ids: shuffle(selected).map(image => image.id), includesRecent: selected.some(image => !old(image)) }
}

// Only IDs live in a batch. Current records supply tags and visibility on every render.
export function createRediscoveryBatches() {
  const batches = new Map<string, RediscoverySelection>()
  return {
    get: (id: string | null) => id ? batches.get(id) : undefined,
    create(id: string, images: Candidate[], previous: string[] = [], now = Date.now(), random = Math.random) {
      const selection = selectRediscovery(images, previous, now, random)
      while (batches.size >= 20) batches.delete(batches.keys().next().value!)
      batches.set(id, selection)
      return selection
    },
  }
}
