import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { testConfig } from './runtime'
import { usePlanner } from '../layers/planner/app/composables/usePlanner'
import type { Task } from '../layers/planner/shared/domain'
const fake = vi.hoisted(() => ({
 listener: null as null | ((event:string,session:{user:{id:string}}|null)=>void),
 reads: [] as {table:string;owner:string}[],
 saved: null as Record<string,unknown>|null,
 failWrite:false,
 readGate:null as null | Promise<unknown>,
}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
 auth:{
  onAuthStateChange:(callback:typeof fake.listener)=>{fake.listener=callback;return {data:{subscription:{unsubscribe:()=>{fake.listener=null}}}}},
  getSession:async()=>({data:{session:{user:{id:'owner-a'}}},error:null}),
  signOut:async()=>({error:null}),
 },
 from:(table:string)=>{
  let owner=''
  const builder={
   select:()=>builder,
   eq:(_column:string,value:string)=>{owner=value;return builder},
   maybeSingle:async()=>({data:null,error:null}),
   then:(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown)=>{
    fake.reads.push({table,owner})
    const result=table==='tasks'&&fake.readGate ? fake.readGate : Promise.resolve({data:[],error:null})
    return result.then(resolve,reject)
   },
   upsert:(value:Record<string,unknown>)=>{
    fake.saved=value
    return {select:()=>({single:async()=>({data:fake.failWrite?null:value,error:fake.failWrite?{message:'저장 연결 실패'}:null})})}
   },
  }
  return builder
 },
})}))
let dispose:(()=>void)|undefined
beforeEach(()=>{
 testConfig.public.supabaseUrl='https://example.supabase.co';testConfig.public.supabaseKey='sb_publishable_test'
 fake.reads=[];fake.failWrite=false;fake.readGate=null;fake.saved=null
 vi.stubGlobal('sessionStorage',{getItem:()=>null,removeItem:()=>{},setItem:()=>{}})
})
afterEach(()=>{dispose?.();dispose=undefined;testConfig.public.supabaseUrl='';testConfig.public.supabaseKey='';vi.unstubAllGlobals()})
it('filters every table read by the signed-in owner and keeps save failures retryable',async()=>{
 const p=usePlanner();dispose=await p.init()
 expect(fake.reads).toEqual(expect.arrayContaining([{table:'tasks',owner:'owner-a'},{table:'projects',owner:'owner-a'},{table:'project_items',owner:'owner-a'}]))
 const task:Task={...p.stamp(),title:'지원 준비',scheduled_date:p.today.value,deadline:null,priority:1,category:'취업 준비',completed:false,project_item_id:null}
 fake.failWrite=true
 expect(await p.run(()=>p.save('tasks',task))).toBe(false)
 expect(p.tasks.value).toEqual([]);expect(p.error.value).toBe('저장 연결 실패')
 fake.failWrite=false
 expect(await p.run(()=>p.save('tasks',task))).toBe(true)
 expect(p.tasks.value).toHaveLength(1)
 await p.save('tasks',{...task,completed:true})
 expect(p.tasks.value).toEqual([{...task,completed:true,status:'done'}])
 await expect(p.save('tasks',{...task,user_id:'owner-b'})).rejects.toThrow('다른 사용자')
})
it('ignores an old account response after sign-out',async()=>{
 let resolveRead:(value:unknown)=>void=()=>{}
 fake.readGate=new Promise(resolve=>{resolveRead=resolve})
 const p=usePlanner();const init=p.init()
 await vi.waitFor(()=>expect(fake.reads.some(read=>read.table==='tasks')).toBe(true))
 fake.listener!('SIGNED_OUT',null)
 resolveRead({data:[{id:'private-task',user_id:'owner-a'}],error:null})
 dispose=await init
 expect(p.user.value).toBeNull();expect(p.tasks.value).toEqual([])
})
