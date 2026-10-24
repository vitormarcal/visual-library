export default defineNuxtPlugin(() => {
  const authenticated = useState('library-authenticated', () => false)
  const version = useState('library-access-version', () => 0)
  const pending = new Set<AbortController>()
  const requests = new WeakMap<object, { controller: AbortController; version: number }>()
  const cookies = import.meta.server ? useRequestHeaders(['cookie']) : {}
  const invalidate = () => {
    version.value++
    authenticated.value = false
    for (const controller of pending) controller.abort()
    pending.clear()
  }
  const libraryApi = $fetch.create({
    retry: 0,
    onRequest({ request, options }) {
      if (typeof request !== 'string' || !request.startsWith('/api/') || request.startsWith('//')) throw new Error('Only library API paths are allowed.')
      if (!authenticated.value && !request.startsWith('/api/auth/')) throw new Error('Sign in required.')
      const controller = new AbortController()
      pending.add(controller)
      requests.set(options, { controller, version: version.value })
      options.signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
      const headers = new Headers(options.headers)
      headers.set('X-Library-Request', '1')
      if (import.meta.server && cookies.cookie) headers.set('cookie', cookies.cookie)
      options.headers = headers
    },
    onResponse({ request, response, options }) {
      const state = requests.get(options)
      if (state) pending.delete(state.controller)
      if (state && state.version !== version.value) throw new Error('Session changed.')
      if (response.status === 401 && request !== '/api/auth/login') invalidate()
    },
    onRequestError({ options }) {
      const state = requests.get(options)
      if (state) pending.delete(state.controller)
    },
  })
  return { provide: { libraryApi, invalidateLibraryAccess: invalidate } }
})
