// Android apps commonly put the URL in text, rather than in the URL field.
export const sharedImageUrl = (form: FormData): string | null => {
  for (const field of ['url', 'text', 'title']) {
    const value = form.get(field)
    if (typeof value !== 'string' || value.length > 8192) continue
    const candidates = value.match(/https?:\/\/[^\s<>"']+/gi) ?? []
    for (const candidate of candidates) {
      try {
        const url = new URL(candidate)
        if (!url.username && !url.password) return url.href
      } catch { /* Continue looking for a usable URL. */ }
    }
  }
  return null
}

export const sharedCaptureMessage = (params: URLSearchParams): string => {
  if (params.get('shared') === 'too-large') return 'Shared content is too large. Share fewer or smaller images.'
  if (params.get('shared') === 'invalid') return 'Could not read shared content. Share image files or a direct image URL.'
  if (params.get('shared') !== 'result') return ''
  const count = (key: string) => {
    const value = params.get(key) ?? ''
    return /^\d{1,2}$/.test(value) ? Number(value) : 0
  }
  const saved = count('saved'), duplicates = count('duplicates'), failed = count('failed')
  const summary = [saved ? `${saved} saved` : '', duplicates ? `${duplicates} already saved` : '', failed ? `${failed} failed` : ''].filter(Boolean).join(' · ')
  return summary + (failed ? '. Could not save some content. Share supported image files or a direct image URL; page and post links are not supported. You can share again to retry.' : '')
}

export const sharedCaptureKeys = ['shared', 'saved', 'duplicates', 'failed']
