export default defineNuxtConfig({
  compatibilityDate: '2026-05-25',
  srcDir: 'app',
  css: ['~/assets/css/global.css'],
  app: {
    head: {
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/library.svg' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'theme-color', content: '#ffffff' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Visual Library' },
      ],
    },
  },
  runtimeConfig: { ownerResetKey: '', libraryOrigin: '', public: { maxImageSizeBytes: 15 * 1024 * 1024 } },
  devtools: { enabled: false },
  typescript: {
    strict: true,
  },
})
