export default defineNuxtConfig({
  compatibilityDate: '2026-05-25',
  srcDir: 'app',
  css: ['~/assets/css/global.css'],
  runtimeConfig: { public: { maxImageSizeBytes: 15 * 1024 * 1024 } },
  devtools: { enabled: false },
  typescript: {
    strict: true,
  },
})
