import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlanner } from '../layers/planner/app/composables/usePlanner'
import type { Task, Project, ProjectItem } from '../layers/planner/shared/domain'
import { postpone } from '../layers/planner/shared/domain'
import { LEGACY_KEY } from '../layers/planner/shared/storage'
function memoryStorage() {
 const data = new Map<string,string>()
 return {getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)}
}
let dispose: (()=>void)|undefined
beforeEach(()=>{vi.stubGlobal('localStorage',memoryStorage());vi.stubGlobal('sessionStorage',memoryStorage())})
afterEach(()=>{dispose?.();dispose=undefined;vi.unstubAllGlobals()})
describe('project and calendar workflows',()=>{
 it('preserves stage-one tasks across the new calendar and reload',async()=>{
  const task:Task={id:'old',user_id:'local',title:'과제',scheduled_date:'2026-11-19',deadline:'2026-12-01',priority:2,category:'학업',project_item_id:null,completed:false,created_at:'2026-11-19T00:00:00Z'}
  localStorage.setItem(LEGACY_KEY,JSON.stringify([task]))
  const planner=usePlanner();dispose=await planner.init()
  await planner.save('tasks',postpone(planner.tasks.value[0]!,'2026-11-24'))
  planner.startDemo()
  expect(planner.tasks.value).toHaveLength(1)
  expect(planner.tasks.value[0]).toMatchObject({id:'old',scheduled_date:'2026-11-24',deadline:'2026-12-01'})
 })
 it('shares a single task between a project item and daily lists',async()=>{
  const p=usePlanner();dispose=await p.init()
  const project:Project={...p.stamp(),title:'공채 지원',company:'기업',deadline:'2026-12-01'}
  await p.save('projects',project)
  const item:ProjectItem={...p.stamp(),project_id:project.id,stage:'준비',title:'자기소개서',content:'초안'}
  await p.save('project_items',item)
  const task:Task={...p.stamp(),title:'초안 작성',scheduled_date:p.today.value,deadline:project.deadline,priority:1,category:'취업 준비',completed:false,project_item_id:item.id}
  await p.save('tasks',task);await p.save('tasks',{...task,completed:true})
  expect(p.tasks.value.filter(t=>t.project_item_id===item.id)).toEqual([{...task,completed:true,status:'done'}])
  await p.save('tasks',postpone(p.tasks.value[0]!,p.tomorrow.value));p.startDemo()
  expect(p.tasks.value).toHaveLength(1);expect(p.tasks.value[0]).toMatchObject({id:task.id,completed:true,project_item_id:item.id,deadline:project.deadline,scheduled_date:p.tomorrow.value})
  await p.save('project_items',{...item,stage:'진행',content:'수정본'})
  expect(p.items.value[0]).toMatchObject({stage:'진행',content:'수정본'})
 })
 it('rejects a broken project connection without losing existing tasks',async()=>{
  const p=usePlanner();dispose=await p.init()
  const saved:Task={...p.stamp(),title:'수업 복습',scheduled_date:p.today.value,deadline:null,priority:2,category:'학업',completed:false,project_item_id:null}
  await p.save('tasks',saved)
  await expect(p.save('tasks',{...saved,project_item_id:'missing'})).rejects.toThrow('연결된 자료')
  expect(p.tasks.value).toEqual([{...saved,status:'todo'}])
 })
})
it('merges new local writes from another tab instead of overwriting them',async()=>{
 const a=usePlanner();const stopA=await a.init()
 const b=usePlanner();const stopB=await b.init()
 try{
  const first:Task={...a.stamp(),title:'첫 탭의 과제',scheduled_date:a.today.value,deadline:null,priority:2,category:'학업',completed:false,project_item_id:null}
  const second:Task={...b.stamp(),title:'둘째 탭의 지원 준비',scheduled_date:b.today.value,deadline:null,priority:1,category:'취업 준비',completed:false,project_item_id:null}
  await a.save('tasks',first);await b.save('tasks',second);a.startDemo()
  expect(a.tasks.value.map(t=>t.id)).toEqual([first.id,second.id])
 }finally{stopA?.();stopB?.()}
})
it('keeps a custom category after save, edit, and reload',async()=>{
 const p=usePlanner();dispose=await p.init()
 const task:Task={...p.stamp(),title:'자격증 공부',scheduled_date:p.today.value,deadline:null,priority:2,category:'자격증',completed:false,project_item_id:null}
 await p.save('tasks',task);await p.save('tasks',{...task,completed:true});p.startDemo()
 expect(p.tasks.value[0]).toMatchObject({category:'자격증',completed:true})
})
it('stores independent deadlines for multiple items in one company project',async()=>{
 const p=usePlanner();dispose=await p.init()
 const project:Project={...p.stamp(),title:'기업 지원',company:'기업',deadline:'2026-11-20'}
 await p.save('projects',project)
 const essay:ProjectItem={...p.stamp(),project_id:project.id,stage:'준비',title:'자소서 제출',content:'초안',deadline:'2026-11-20'}
 const exam:ProjectItem={...p.stamp(),project_id:project.id,stage:'진행',title:'인적성 준비',content:'문제 풀이',deadline:'2026-12-05'}
 await p.save('project_items',essay);await p.save('project_items',exam);p.startDemo()
 expect(p.items.value.map(item=>item.deadline)).toEqual(['2026-11-20','2026-12-05'])
 expect(p.projects.value[0]!.deadline).toBe('2026-11-20')
 await expect(p.save('project_items',{...essay,deadline:'2026-02-30'})).rejects.toThrow('입력 내용')
})
it('moves a task to trash and restores the same dates, state, and identity',async()=>{
 const p=usePlanner();dispose=await p.init()
 const task:Task={...p.stamp(),title:'복원할 작업',scheduled_date:p.today.value,deadline:'2026-12-01',priority:1,category:'학업',completed:false,project_item_id:null,status:'in_progress'}
 await p.save('tasks',task)
 expect(await p.trashTask(task)).toBe(true)
 expect(p.tasks.value).toHaveLength(0);expect(p.ordered.value).toHaveLength(0)
 expect(p.trash.value[0]).toMatchObject({...task,deleted_at:expect.any(String)})
 p.startDemo();expect(p.trash.value).toHaveLength(1)
 expect(await p.restoreTask(p.trash.value[0]!)).toBe(true)
 expect(p.trash.value).toHaveLength(0);expect(p.tasks.value[0]).toEqual({...task,deleted_at:null})
})
it('creates one synchronized project card and schedule and updates both without duplicates',async()=>{
 const p=usePlanner();dispose=await p.init()
 const project:Project={...p.stamp(),title:'채용 프로젝트',company:'기업',start_date:'2026-11-01',deadline:'2026-11-30'}
 await p.save('projects',project)
 const item:ProjectItem={...p.stamp(),project_id:project.id,stage:'준비',title:'자소서',content:'자료',deadline:'2026-11-25'}
 const task:Task={...p.stamp(),id:item.id,title:item.title,scheduled_date:p.today.value,deadline:item.deadline!,priority:2,category:'취업 준비',completed:false,project_item_id:item.id}
 await p.saveProjectWork(item,task);await p.saveProjectWork({...item,deadline:'2026-11-27'},{...task,scheduled_date:p.tomorrow.value,deadline:'2026-11-27'})
 expect(p.items.value).toHaveLength(1);expect(p.tasks.value).toHaveLength(1)
 expect(p.tasks.value[0]).toMatchObject({id:item.id,project_item_id:item.id,scheduled_date:p.tomorrow.value,deadline:'2026-11-27'})
 await expect(p.save('projects',{...project,start_date:'2026-12-01'})).rejects.toThrow()
})
it('keeps archived text and links with their project across reload',async()=>{
 const p=usePlanner();dispose=await p.init()
 const project:Project={...p.stamp(),title:'자료 보관 프로젝트',company:'기업',deadline:null}
 await p.save('projects',project)
 const material={...p.stamp(),project_id:project.id,title:'JD 정리',kind:'JD' as const,content:'지원 직무와 역량',url:'https://example.com/jobs',file_name:null,file_size:null,file_type:null,storage_path:null,updated_at:new Date().toISOString()}
 await p.saveMaterial(material);p.startDemo()
 expect(p.materials.value).toEqual([material])
 await expect(p.saveMaterial({...material,url:'javascript:alert(1)'})).rejects.toThrow('입력 내용')
})
it('stores optional priorities per week without overwriting another week or routine preferences',async()=>{
 const p=usePlanner();dispose=await p.init()
 await p.saveWeekly('2026-11-15',['자소서 마무리','기업 분석',''])
 await p.saveWeekly('2026-11-22',['인적성 준비'])
 await p.saveSettings('Asia/Seoul','이름',true)
 p.startDemo()
 expect(p.settings.value.weekly_priorities).toEqual({'2026-11-15':['자소서 마무리','기업 분석',''],'2026-11-22':['인적성 준비']})
 expect(p.settings.value.show_routine).toBe(true)
 expect(await p.saveWeekly('2026-11-29',[])).toBe(true)
 expect(await p.saveWeekly('2026-11-19',['주 시작일이 아님'])).toBe(false)
})
it('archives and reopens a project without deleting its archive or changing task states',async()=>{
 const p=usePlanner();dispose=await p.init()
 const project:Project={...p.stamp(),title:'종료 테스트',company:'기업',deadline:null}
 await p.save('projects',project)
 expect(await p.setProjectArchived(project,true)).toBe(true)
 expect(p.projects.value[0]!.archived_at).toEqual(expect.any(String))
 p.startDemo();expect(p.projects.value).toHaveLength(1)
 expect(await p.setProjectArchived(p.projects.value[0]!,false)).toBe(true)
 expect(p.projects.value[0]!.archived_at).toBeNull()
})
