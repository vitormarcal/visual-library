export const discoveryImages = <T extends { hiddenFromGallery?: boolean }>(images: T[], hidden = false) =>
  images.filter(image => Boolean(image.hiddenFromGallery) === hidden)
