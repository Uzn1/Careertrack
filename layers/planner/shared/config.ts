export function publicConfigError(url: string, key: string): string {
  if (!url && !key) return ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.protocol === 'http:')) throw new Error()
  } catch { return 'Supabase 프로젝트 URL 형식을 확인해 주세요.' }
  if (key.startsWith('sb_publishable_')) return ''
  try {
    const part = key.split('.')[1]!
    const payload = JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))) as {role?:string}
    if (payload.role === 'anon') return ''
  } catch { /* Only publishable keys or legacy anon JWTs belong in the browser. */ }
  return 'Supabase 공개 키만 사용할 수 있습니다. 비밀 키나 서비스 권한 키는 입력하지 마세요.'
}
