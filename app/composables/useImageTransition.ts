export const useImageTransition = (source: () => string | undefined) => {
  const imageLoaded = ref(false)
  watch(source, () => { imageLoaded.value = false }, { flush: 'sync' })
  const revealImage = (event: Event) => {
    if ((event.target as HTMLImageElement).getAttribute('src') === source()) imageLoaded.value = true
  }
  return { imageLoaded, revealImage }
}
