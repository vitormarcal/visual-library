export default defineNuxtPlugin({
  name: 'library-history',
  setup() {
    // Nuxt's root-only router replaces history.state in its app:created hook.
    // Capture the existing entry before that hook, without patching browser APIs.
    return { provide: { libraryHistoryState: history.state } }
  },
})
