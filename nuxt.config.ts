export default defineNuxtConfig({
  compatibilityDate: '2026-05-25',
  srcDir: 'app',
  css: ['~/assets/css/global.css'],
  devtools: { enabled: false },
  typescript: {
    strict: true,
  },
})
