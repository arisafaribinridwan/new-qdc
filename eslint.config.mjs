// https://nuxt.com/docs/guide/concepts/eslint
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: [
    'data/**',
    'storage/**',
    'templates/**',
    'node_modules/**',
    '.nuxt/**',
    '.output/**',
    'dist/**'
  ]
})
