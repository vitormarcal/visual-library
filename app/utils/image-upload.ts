export const imageMimeTypes = ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']
export const imageExtensions = ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']
export const maxImageSizeBytes = 15 * 1024 * 1024
export const acceptImageTypes = [...imageMimeTypes, ...imageExtensions].join(',')

type LocalFile = Pick<File, 'name' | 'type' | 'size'>
export type UploadFailure<T = File> = { file: T; message: string; retryable: boolean }
export type UploadResult<T = File> = { saved: number; duplicates: number; failures: UploadFailure<T>[] }

export const isImageFile = (file: Pick<File, 'name' | 'type'>) => imageMimeTypes.includes(file.type)
  || imageExtensions.some((extension) => file.name.toLowerCase().endsWith(extension))

export const localImageError = (file: LocalFile) => {
  if (!isImageFile(file)) return 'Unsupported file type. Use JPEG, PNG, WebP, GIF, or AVIF.'
  if (!file.size) return 'This file is empty. Choose another image.'
  if (file.size > maxImageSizeBytes) return 'Image is too large. Maximum size is 15 MB.'
  return null
}

export const uploadError = (error: unknown) => {
  const response = error as { statusCode?: number; status?: number; data?: { statusCode?: number; statusMessage?: string } } | null
  const status = response?.statusCode ?? response?.status ?? response?.data?.statusCode
  const retryable = !status || status >= 500 || status === 408 || status === 429
  const message = status === 413 ? 'Image is too large. Maximum size is 15 MB.'
    : status === 400 || status === 415 ? 'This image cannot be saved. Choose a supported image.'
      : retryable ? 'Could not save this image. Try again.' : 'This image cannot be saved.'
  return { message, retryable }
}

// Files and items describe the same dropped files. Prefer one representation.
export const filesFromTransfer = (transfer: Pick<DataTransfer, 'files' | 'items'> | null): File[] => {
  if (!transfer) return []
  const files = Array.from(transfer.files ?? [])
  if (files.length) return files
  return Array.from(transfer.items ?? []).filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile()).filter((file): file is File => file !== null)
}

export const saveImageBatch = async <T extends LocalFile>(
  files: T[], save: (file: T) => Promise<'saved' | 'duplicate'>,
  progress: (current: number, total: number) => void,
  previous?: UploadResult<T>,
): Promise<UploadResult<T>> => {
  const result: UploadResult<T> = {
    saved: previous?.saved ?? 0, duplicates: previous?.duplicates ?? 0,
    failures: previous?.failures.filter((failure) => !failure.retryable) ?? [],
  }
  for (const [index, file] of files.entries()) {
    progress(index + 1, files.length)
    const invalid = localImageError(file)
    if (invalid) { result.failures.push({ file, message: invalid, retryable: false }); continue }
    try {
      if (await save(file) === 'duplicate') result.duplicates += 1
      else result.saved += 1
    } catch (error) {
      result.failures.push({ file, ...uploadError(error) })
    }
  }
  return result
}

export const uploadSummary = (result: UploadResult) => [
  result.saved ? `${result.saved} saved` : '',
  result.duplicates ? `${result.duplicates} already saved` : '',
  result.failures.length ? `${result.failures.length} failed` : '',
].filter(Boolean).join(' · ')
