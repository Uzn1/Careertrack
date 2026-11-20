import { describe, expect, it } from 'vitest'
import { emptyData, LEGACY_KEY, LOCAL_KEY, parseLocal, readLocal, writeLocal } from '../layers/planner/shared/storage'
import type { Task } from '../layers/planner/shared/domain'
const task: Task = { id:'t1',user_id:'local',title:'과제',scheduled_date:'2026-11-19',deadline:'2026-11-25',priority:1,category:'학업',completed:false,project_item_id:null,created_at:'2026-11-19T01:00:00Z' }
describe('local persistence', () => {
 it('imports stage-one tasks without modifying the original', () => {
   const legacy = JSON.stringify([task]); const calls: string[] = []
   const data = readLocal({getItem: key => { calls.push(key); return key === LEGACY_KEY ? legacy : null }})
   expect(data.tasks[0]).toEqual({...task,user_id:'demo'}); expect(calls).toEqual([LOCAL_KEY,LEGACY_KEY])
 })
 it('rejects corrupt saved tasks and broken links instead of erasing them', () => {
   expect(()=>parseLocal(JSON.stringify({...emptyData(),tasks:[{...task,scheduled_date:'2026-02-30'}]}))).toThrow()
   expect(()=>parseLocal(JSON.stringify({...emptyData(),tasks:[{...task,project_item_id:'missing'}]}))).toThrow()
 })
 it('surfaces storage failures so callers keep the unsaved form', () => {
   expect(()=>writeLocal({setItem:()=>{throw new Error('Quota exceeded')}},{...emptyData(),tasks:[task]})).toThrow('입력 내용을 보존')
 })
 it('rejects duplicate task records',()=>{expect(()=>parseLocal(JSON.stringify({...emptyData(),tasks:[task,task]}))).toThrow('중복')})
 it('imports an old dated project schedule once and does not recreate it after permanent deletion',()=>{
   const project={id:'project',user_id:'demo',title:'기업',company:'기업',deadline:null,created_at:task.created_at}
   const item={id:'item',user_id:'demo',project_id:project.id,title:'자소서',stage:'준비',content:'메모',deadline:'2026-11-25',created_at:task.created_at}
   let raw=JSON.stringify({...emptyData(),project_schedules_migrated:undefined,projects:[project],items:[item]})
   const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value}}
   const migrated=readLocal(storage)
   expect(migrated.tasks).toHaveLength(1)
   writeLocal(storage,{...migrated,tasks:[]})
   expect(readLocal(storage).tasks).toEqual([])
   expect(readLocal(storage).items).toEqual([item])
 })
})
