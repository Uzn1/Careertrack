import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
export default defineConfig({ resolve: { alias: { '#imports': fileURLToPath(new URL('./tests/runtime.ts', import.meta.url)) } } })
