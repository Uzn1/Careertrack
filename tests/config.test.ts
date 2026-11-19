import { expect, it } from 'vitest'
import { publicConfigError } from '../layers/planner/shared/config'
it('allows no configuration for local mode and public keys for Supabase',()=>{
 expect(publicConfigError('','')).toBe('')
 expect(publicConfigError('https://example.supabase.co','sb_publishable_example')).toBe('')
 const anon = `header.${btoa(JSON.stringify({role:'anon'}))}.signature`
 expect(publicConfigError('https://example.supabase.co',anon)).toBe('')
})
it('blocks privileged keys and malformed endpoints without returning their value',()=>{
 const key = 'sb_secret_example'
 expect(publicConfigError('https://example.supabase.co',key)).not.toBe('')
 expect(publicConfigError('https://example.supabase.co',key)).not.toContain(key)
 const service = `header.${btoa(JSON.stringify({role:'service_role'}))}.signature`
 expect(publicConfigError('https://example.supabase.co',service)).not.toBe('')
 expect(publicConfigError('javascript:alert(1)','sb_publishable_example')).not.toBe('')
})
