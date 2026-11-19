import { fileURLToPath } from 'node:url'
import { publicConfigError } from './shared/config'
import tailwindcss from '@tailwindcss/vite'
const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || ''
const issue = publicConfigError(supabaseUrl, supabaseKey)
if (issue) throw new Error(issue)
export default defineNuxtConfig({
  ssr: false,
  css: [fileURLToPath(new URL('./app/assets/main.css', import.meta.url))],
  vite: { plugins: [tailwindcss()] },
  runtimeConfig: { public: { supabaseUrl, supabaseKey, variant: 'feed', featureStage: 5 } },
  app: { head: { htmlAttrs: { lang: 'ko' }, title: 'CareerTrack · 커리어 플래너', meta: [{ name: 'description', content: '오늘의 작은 계획이 내일의 커리어가 됩니다. 학업과 취업 준비를 한곳에서.' }] } },
  devtools: { enabled: false },
})
