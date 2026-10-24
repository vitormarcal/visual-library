export default defineNuxtPlugin({
  name: 'library-security',
  dependsOn: ['nuxt:head'],
  setup(nuxtApp) {
    const nonce = nuxtApp.ssrContext?.event.context.scriptNonce
    if (typeof nonce !== 'string') return
    // Nonce trusted framework scripts through Unhead, never rewrite user HTML.
    // Nuxt also picks this nonce up for its SSR streaming bootstrap scripts.
    nuxtApp.ssrContext!.head.hooks.hook('tags:resolve', context => {
      for (const tag of context.tags) if (tag.tag === 'script') tag.props.nonce = nonce
    })
  },
})
