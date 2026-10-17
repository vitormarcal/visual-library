export type ImageTag = { id: string; name: string; normalizedName: string }
export type ImageRecord = {
  id: string; filename: string; originalName: string | null; mimeType: string
  sizeBytes: number; createdAt: string; src: string; width: number | null; height: number | null
  tags: ImageTag[]; source: string; hiddenFromGallery: boolean
}
