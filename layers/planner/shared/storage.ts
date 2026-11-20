import { validCategory, validRoutine, safeWebUrl, validWeeklyPriorities, validMonthlyPriorities } from './domain'
import type { Project, ProjectItem, Task, UserSettings, RoutineEntry, ProjectMaterial } from './domain'

export interface PlannerData { project_schedules_migrated?:boolean; materials:ProjectMaterial[]; routines: RoutineEntry[]; tasks: Task[]; projects: Project[]; items: ProjectItem[]; settings: UserSettings }
export const LOCAL_KEY = 'career-planner-demo-v1'
export const LEGACY_KEY = 'career-planner-stage-one-v1'
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value: unknown): value is string => typeof value === 'string'
const date = (value: unknown) => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const base = (v: Record<string, unknown>) => text(v.id) && text(v.user_id) && text(v.created_at) && !Number.isNaN(Date.parse(v.created_at)) && text(v.title) && v.title.trim().length > 0 && v.title.length <= 200
export function isTask(v: unknown): v is Task {
  return record(v) && base(v) && date(v.scheduled_date) && (v.deadline === null || date(v.deadline)) && [1, 2, 3].includes(Number(v.priority)) && typeof v.priority === 'number' && typeof v.completed === 'boolean' && (v.status === undefined || (['todo','in_progress','done'].includes(String(v.status)) && (v.status === 'done') === v.completed)) && (v.deleted_at === undefined || v.deleted_at === null || (text(v.deleted_at) && !Number.isNaN(Date.parse(v.deleted_at)))) && validCategory(v.category) && (v.project_item_id === null || text(v.project_item_id))
}
export function isProject(v: unknown): v is Project { return record(v) && base(v) && (v.sort_order === undefined || (Number.isSafeInteger(v.sort_order) && Number(v.sort_order)>=0)) && text(v.company) && v.company.length <= 200 && (v.deadline === null || date(v.deadline)) && (v.start_date === undefined || v.start_date === null || date(v.start_date)) && (!v.start_date || !v.deadline || String(v.start_date) <= String(v.deadline)) && (v.archived_at === undefined || v.archived_at === null || (text(v.archived_at) && !Number.isNaN(Date.parse(v.archived_at)))) }
export function isItem(v: unknown): v is ProjectItem { return record(v) && base(v) && text(v.project_id) && ['준비', '진행', '마감'].includes(String(v.stage)) && text(v.content) && v.content.length <= 20000 && (v.deadline === undefined || v.deadline === null || date(v.deadline)) }
export function isMaterial(v:unknown):v is ProjectMaterial{
 return record(v)&&base(v)&&text(v.project_id)&&['자소서','포트폴리오','JD','기업 분석','기타'].includes(String(v.kind))&&text(v.content)&&v.content.length<=50000&&(v.url===null||(text(v.url)&&v.url.length<=2048&&safeWebUrl(v.url)))&&text(v.updated_at)&&!Number.isNaN(Date.parse(v.updated_at))
 &&(v.storage_path===null||(text(v.storage_path)&&text(v.file_name)&&v.file_name.length<=255&&typeof v.file_size==='number'&&v.file_size>0&&v.file_size<=10485760&&text(v.file_type)))
}
export function isSettings(v: unknown): v is UserSettings {
  if (!record(v) || !text(v.user_id) || !text(v.timezone) || !text(v.display_name) || v.display_name.length > 80 || (v.show_routine !== undefined && typeof v.show_routine !== 'boolean') || (v.weekly_priorities !== undefined && !validWeeklyPriorities(v.weekly_priorities)) || (v.monthly_priorities !== undefined && !validMonthlyPriorities(v.monthly_priorities))) return false
  try { new Intl.DateTimeFormat('ko-KR', { timeZone: v.timezone }).format(); return true } catch { return false }
}
export function emptyData(): PlannerData { return { project_schedules_migrated:true, materials:[], routines: [], tasks: [], projects: [], items: [], settings: { user_id: 'demo', timezone: 'Asia/Seoul', display_name: '' } } }
export function parseLocal(raw: string): PlannerData {
  const v: unknown = JSON.parse(raw)
  if (!record(v) || (v.project_schedules_migrated !== undefined && typeof v.project_schedules_migrated !== 'boolean') || !Array.isArray(v.tasks) || !v.tasks.every(isTask) || !Array.isArray(v.projects) || !v.projects.every(isProject) || !Array.isArray(v.items) || !v.items.every(isItem) || !isSettings(v.settings) || (v.materials !== undefined && (!Array.isArray(v.materials) || !v.materials.every(isMaterial))) || (v.routines !== undefined && (!Array.isArray(v.routines) || !v.routines.every(validRoutine)))) throw new Error('저장된 자료 형식을 읽을 수 없습니다. 원본은 그대로 보존했습니다.')
  const data = { ...v, routines: v.routines || [], materials:v.materials||[] } as unknown as PlannerData
  for (const list of [data.tasks, data.projects, data.items, data.routines, data.materials]) if (new Set(list.map(v => v.id)).size !== list.length) throw new Error('중복된 자료가 있어 불러오기를 중단했습니다. 원본은 보존했습니다.')
  if (data.materials.some(material=>!data.projects.some(project=>project.id===material.project_id)) || data.items.some(item => !data.projects.some(p => p.id === item.project_id)) || data.tasks.some(task => task.project_item_id && !data.items.some(i => i.id === task.project_item_id))) throw new Error('연결된 자료를 찾지 못했습니다. 원본은 보존했습니다.')
  return data
}
export function readLocal(storage: Pick<Storage, 'getItem'>): PlannerData {
  const raw = storage.getItem(LOCAL_KEY)
  if (raw) {
    const data=parseLocal(raw)
    if(!data.project_schedules_migrated)for(const item of data.items){
      if(item.deadline && !data.tasks.some(task=>task.project_item_id===item.id || task.id===item.id)) data.tasks.push({id:item.id,user_id:item.user_id,title:item.title,scheduled_date:item.deadline,deadline:item.deadline,priority:2,category:'취업 준비',completed:false,status:'todo',project_item_id:item.id,created_at:item.created_at})
    }
    data.project_schedules_migrated=true
    return data
  }
  const legacy = storage.getItem(LEGACY_KEY)
  if (!legacy) return emptyData()
  const values: unknown = JSON.parse(legacy)
  if (!Array.isArray(values) || !values.every(isTask)) throw new Error('1단계 자료를 읽지 못했습니다. 원본은 보존했습니다.')
  return { ...emptyData(), tasks: values.map(task => ({ ...task, user_id: 'demo' })) }
}
export function writeLocal(storage: Pick<Storage, 'setItem'>, data: PlannerData): void {
  const raw = JSON.stringify(data)
  parseLocal(raw)
  try { storage.setItem(LOCAL_KEY, raw) } catch { throw new Error('브라우저에 저장하지 못했습니다. 입력 내용을 보존했으니 저장 공간을 확인하고 다시 시도하세요.') }
}
