import { fileURLToPath } from 'node:url'
export default defineNuxtConfig({ extends: ['../../layers/planner'], buildDir: fileURLToPath(new URL(process.env.NODE_ENV === 'production' ? './.nuxt-build' : './.nuxt', import.meta.url)), compatibilityDate: '2026-11-19', runtimeConfig: { public: { variant: 'workspace' } } })
