export default defineNuxtConfig({
  compatibilityDate: '2026-05-17',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  typescript: {
    strict: true,
    typeCheck: true
  },
  css: ['~/assets/css/main.css']
})
