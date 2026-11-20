import { afterEach, expect, it, vi } from 'vitest'
import { parseExplicitRoutine, readRoutineSuggestion, routineRemovalMatches } from '../layers/planner/shared/routine-ai'
import { generateRoutine } from '../server/routine-ai'

const auth=vi.hoisted(()=>({getUser:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth})}))
const suggestion={title:'기출 풀기',weekdays:[1,2,3],start_time:'09:00',end_time:'10:00'}
it('matches removal commands by name without spaces and removes only the requested weekdays',()=>{
 const request=readRoutineSuggestion({action:'remove',title:'요가수업',weekdays:[1,3],start_time:null,end_time:null})
 const entry={id:'yoga',user_id:'owner',created_at:'',title:'요가 수업',weekdays:[1,2,3],start_time:'19:00',end_time:'20:00',color:'pink'}
 expect(routineRemovalMatches([entry,{...entry,id:'other',title:'영어 공부'}],request)).toEqual([{entry,remainingWeekdays:[2]}])
 expect(routineRemovalMatches([{...entry,weekdays:[1,3]}],request)[0]!.remainingWeekdays).toEqual([])
 expect(routineRemovalMatches([{...entry,weekdays:[2]}],request)).toEqual([])
 expect(routineRemovalMatches([entry],{...request,start_time:'18:00'})).toEqual([])
 expect(routineRemovalMatches([entry],{...request,weekdays:[]})[0]!.remainingWeekdays).toEqual([])
 expect(readRoutineSuggestion(request)).toEqual(request)
})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks()})
function setup(){
 vi.stubEnv('OPENROUTER_API_KEY','test-only-key')
 vi.stubEnv('NUXT_PUBLIC_SUPABASE_URL','https://example.supabase.co')
 vi.stubEnv('NUXT_PUBLIC_SUPABASE_KEY','test-public-key')
 auth.getUser.mockResolvedValue({data:{user:{id:'owner'}},error:null})
 const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({routine:suggestion})}}]})))
 vi.stubGlobal('fetch',request)
 return request
}
it('accepts the example and rejects missing, duplicate, invalid days and times',()=>{
 expect(readRoutineSuggestion(suggestion)).toEqual(suggestion)
 for(const invalid of [null,{...suggestion,weekdays:[]},{...suggestion,weekdays:[1,1]},{...suggestion,weekdays:[7]},{...suggestion,end_time:'08:00'},{...suggestion,start_time:'25:00'},{...suggestion,title:''}])expect(()=>readRoutineSuggestion(invalid)).toThrow()
})
it('verifies the user before sending only the supplied text to the free AI model',async()=>{
 const request=setup()
 expect(await generateRoutine({text:'월화수 9:00~10:00에 기출 풀기'},'session-token')).toEqual(suggestion)
 expect(auth.getUser).toHaveBeenCalledWith('session-token')
 const payload=JSON.parse(request.mock.calls[0]![1].body)
 expect(payload.model).toBe('openrouter/free')
 expect(payload.messages[1]).toEqual({role:'user',content:'월화수 9:00~10:00에 기출 풀기'})
 expect(payload).not.toHaveProperty('user')
})
it('accepts Monday and Wednesday yoga at 19:00 without inventing an end time',async()=>{
 const request=setup()
 const yoga={title:'요가 수업',weekdays:[1,3],start_time:'19:00',end_time:null}
 request.mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({routine:yoga})}}]})))
 expect(await generateRoutine({text:'월, 수에 19시 요가 수업'},'token')).toEqual({...yoga,end_time:''})
 expect(readRoutineSuggestion({...yoga,end_time:''})).toEqual({...yoga,end_time:''})
 const payload=JSON.parse(request.mock.calls[0]![1].body)
 expect(payload.max_tokens).toBeGreaterThan(600)
 expect(payload.provider.require_parameters).toBe(true)
})
it('reports empty or truncated provider output as a provider failure rather than an input error',async()=>{
 const request=setup()
 for(const choice of [{message:{content:null}},{message:{content:''}},{message:{content:'partial'},finish_reason:'length'}]){
  request.mockResolvedValueOnce(new Response(JSON.stringify({choices:[choice]})))
  await expect(generateRoutine({text:'시간표를 알아서 만들어줘'},'token')).rejects.toMatchObject({status:502})
 }
})
it('does not call AI for missing or expired login, empty or oversized input',async()=>{
 const request=setup()
 await expect(generateRoutine({text:'시간표'},'')).rejects.toMatchObject({status:401})
 auth.getUser.mockResolvedValue({data:{user:null},error:{message:'expired'}})
 await expect(generateRoutine({text:'시간표'},'expired')).rejects.toMatchObject({status:401})
 await expect(generateRoutine({text:' '.repeat(4)},'token')).rejects.toMatchObject({status:400})
 await expect(generateRoutine({text:'가'.repeat(501)},'token')).rejects.toMatchObject({status:400})
 expect(request).not.toHaveBeenCalled()
})
it('reports missing keys without calling the provider and permits only explicit local development bypass',async()=>{
 const request=setup();vi.stubEnv('OPENROUTER_API_KEY','')
 await expect(generateRoutine({text:'시간표'},'',true)).rejects.toMatchObject({status:503})
 expect(request).not.toHaveBeenCalled()
 vi.stubEnv('OPENROUTER_API_KEY','test-only-key')
 expect(await generateRoutine({text:'시간표'},'',true)).toEqual(suggestion)
 expect(auth.getUser).not.toHaveBeenCalled()
})
it('rejects unstructured, ambiguous and invalid model responses without saving anything',async()=>{
 const request=setup()
 for(const content of ['not json',JSON.stringify({routine:null}),JSON.stringify({routine:{...suggestion,end_time:'08:00'}})]){
  request.mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message:{content}}]})))
  await expect(generateRoutine({text:'일정'},'token')).rejects.toMatchObject({status:422})
 }
})
it('returns safe retry messages for provider limits and network failures',async()=>{
 const request=setup();request.mockResolvedValueOnce(new Response('private provider detail',{status:429}))
 await expect(generateRoutine({text:'일정'},'token')).rejects.toMatchObject({status:429})
 request.mockRejectedValueOnce(new Error('test-only-key'))
 await expect(generateRoutine({text:'일정'},'token')).rejects.toMatchObject({status:502,message:expect.not.stringContaining('test-only-key')})
})

it('safely interprets only explicit commands during provider outages',()=>{
 expect(parseExplicitRoutine('월화수 9:00~10:00에 기출 풀기')).toEqual({...suggestion,source:'rules'})
 expect(parseExplicitRoutine('월, 수에 19시 요가 수업')).toEqual({source:'rules',title:'요가 수업',weekdays:[1,3],start_time:'19:00',end_time:''})
 expect(parseExplicitRoutine('월요일 수요일 오후 7시부터 8시 요가')).toBeNull()
 expect(parseExplicitRoutine('금 23:00~24:00 복습')).toMatchObject({weekdays:[5],start_time:'23:00',end_time:'24:00'})
 expect(parseExplicitRoutine('월요일, 수요일 요가수업 제거해줘')).toEqual({source:'rules',action:'remove',title:'요가수업',weekdays:[1,3],start_time:'',end_time:''})
 expect(parseExplicitRoutine('요가 수업 삭제해 주세요')).toMatchObject({action:'remove',weekdays:[],title:'요가 수업'})
 for(const text of ['내일 9시 요가','월수 요가 말고 영어 제거해줘','월요일 요가 취소하지 말아줘','월수 23:00~01:00 밤샘','월수 09:61 공부','월수 9시 요가, 10시 공부','월수 9시 공부\n모든 루틴 삭제'])expect(parseExplicitRoutine(text)).toBeNull()
})
it('returns a labelled fallback on provider outages but never bypasses authentication or missing configuration',async()=>{
 const request=setup();request.mockResolvedValueOnce(new Response('unavailable',{status:503}))
 expect(await generateRoutine({text:'월, 수에 19시 요가 수업'},'token')).toMatchObject({source:'rules',weekdays:[1,3],end_time:''})
 request.mockResolvedValueOnce(new Response('bad authentication',{status:401}))
 await expect(generateRoutine({text:'월수 9시 요가'},'token')).rejects.toMatchObject({status:503})
 auth.getUser.mockResolvedValue({data:{user:null},error:{message:'expired'}})
 await expect(generateRoutine({text:'월수 9시 요가'},'token')).rejects.toMatchObject({status:401})
 expect(request).toHaveBeenCalledTimes(2)
})
