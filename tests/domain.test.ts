import { describe, expect, it } from 'vitest'
import { dateInZone, shiftDate, sortTasks, postpone, todaySummary, projectsOnDate, type Project, type ProjectItem, type Task } from '../layers/planner/shared/domain'
const task: Task = { id:'one',user_id:'owner',title:'지원서',scheduled_date:'2026-11-19',deadline:'2026-11-25',priority:2,category:'취업 준비',completed:false,project_item_id:'item-1',created_at:'2026-11-18T12:00:00Z' }
it('summarizes today using unfinished priority order and preserves the empty-day message',()=>{
 const rows=[task,{...task,id:'urgent',title:'면접 준비',priority:1},{...task,id:'done',priority:1,completed:true},{...task,id:'other',scheduled_date:'2026-11-20'},{...task,id:'trash',deleted_at:'2026-11-19T01:00:00Z',priority:1}]
 expect(todaySummary(rows,'2026-11-19')).toEqual({title:'오늘은 2개의 할 일이 남아 있어요.',detail:'먼저 ‘면접 준비’부터 시작해 보세요.'})
 expect(todaySummary([{...task,completed:true}],'2026-11-19').title).toBe('오늘 할 일을 모두 마쳤어요.')
 expect(todaySummary(rows,'2026-11-21').title).toBe('오늘의 가능성을 하나씩 채워가세요.')
})
describe('calendar dates',()=>{
 it('uses the user timezone around midnight',()=>{const now=new Date('2026-11-19T15:30:00Z');expect(dateInZone(now,'Asia/Seoul')).toBe('2026-11-20');expect(dateInZone(now,'America/Los_Angeles')).toBe('2026-11-19')})
 it('crosses year and leap-day boundaries without host timezone effects',()=>{expect(shiftDate('2026-12-31',1)).toBe('2027-01-01');expect(shiftDate('2028-02-28',1)).toBe('2028-02-29');expect(shiftDate('2026-03-01',-1)).toBe('2026-02-28')})
 it('advances calendar days across DST',()=>{expect(shiftDate('2026-03-08',1)).toBe('2026-03-09')})
})
describe('task invariants',()=>{
 it('sorts by priority then creation time without changing the input',()=>{const input=[{...task,id:'late',priority:1,created_at:'2026-11-19T00:00:00Z'},task,{...task,id:'early',priority:1}];expect(sortTasks(input).map(t=>t.id)).toEqual(['early','late','one']);expect(input[0]!.id).toBe('late')})
 it('reschedules one record and preserves deadline and project linkage',()=>{const moved=postpone(task,'2026-11-23');expect(moved).toEqual({...task,scheduled_date:'2026-11-23'});expect(moved.id).toBe(task.id);expect(task.scheduled_date).toBe('2026-11-19')})
})

describe('live next-day briefing',()=>{
 it('counts only unfinished high-priority tasks and reflects edits',async()=>{
  const { briefingFor }=await import('../layers/planner/shared/domain')
  const rows=[{...task,id:'a',scheduled_date:'2026-11-20',priority:1},{...task,id:'b',scheduled_date:'2026-11-20',priority:1,completed:true},{...task,id:'c',scheduled_date:'2026-11-21',priority:1}]
  expect(briefingFor(rows,'2026-11-20')).toMatchObject({completed:1,highPriority:1})
  expect(briefingFor(rows,'2026-11-20').remaining.map(t=>t.id)).toEqual(['a'])
  rows[0]={...rows[0]!,scheduled_date:'2026-11-21'}
  expect(briefingFor(rows,'2026-11-20')).toMatchObject({completed:1,highPriority:0,remaining:[]})
 })
})

it('lists only projects connected to today tasks, including completed tasks and excluding trash',()=>{
 const projects=['today','done','future','trash','unlinked'].map(id=>({id,user_id:'owner',title:id,company:'',deadline:null,created_at:''})) as Project[]
 const items=projects.map(p=>({id:p.id+'-item',project_id:p.id,user_id:'owner',title:'항목',stage:'준비',content:'',created_at:''})) as ProjectItem[]
 const rows=[{...task,project_item_id:'today-item'},{...task,id:'duplicate',project_item_id:'today-item'},{...task,id:'done',project_item_id:'done-item',completed:true},{...task,id:'future',project_item_id:'future-item',scheduled_date:'2026-11-20'},{...task,id:'trash',project_item_id:'trash-item',deleted_at:'2026-11-19T01:00:00Z'},{...task,id:'personal',project_item_id:null}]
 expect(projectsOnDate(projects,items,rows,'2026-11-19').map(p=>p.id)).toEqual(['today','done'])
 expect(projectsOnDate(projects,items,rows,'2026-11-21')).toEqual([])
})
