import { expect, it } from 'vitest'
import { taskStatus, withTaskStatus, type Task } from '../layers/planner/shared/domain'
import { emptyData, parseLocal } from '../layers/planner/shared/storage'
const task:Task={id:'one',user_id:'demo',title:'지원서',scheduled_date:'2026-11-19',deadline:'2026-11-30',priority:1,category:'취업 준비',completed:false,project_item_id:null,created_at:'2026-11-19T01:00:00Z'}
it('maps existing completed and unfinished records into the board without data loss',()=>{expect(taskStatus(task)).toBe('todo');expect(taskStatus({...task,completed:true})).toBe('done')})
it('moves a single task through all three states and keeps deadline and identity',()=>{
 const started=withTaskStatus(task,'in_progress');expect(started).toEqual({...task,status:'in_progress',completed:false})
 const done=withTaskStatus(started,'done');expect(taskStatus(done)).toBe('done');expect(done.completed).toBe(true)
 expect(withTaskStatus(done,'todo')).toEqual({...task,status:'todo',completed:false})
})
it('rejects inconsistent completion and status in saved data',()=>{expect(()=>parseLocal(JSON.stringify({...emptyData(),tasks:[{...task,status:'done',completed:false}]}))).toThrow()})
