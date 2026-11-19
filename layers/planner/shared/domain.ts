export type Stage = '준비' | '진행' | '마감'
export type Category = string
export interface Project { archived_at?: string | null; start_date?: string | null; id: string; user_id: string; title: string; company: string; deadline: string | null; created_at: string }
export interface ProjectItem { deadline?: string | null; id: string; user_id: string; project_id: string; stage: Stage; title: string; content: string; created_at: string }
export interface Task { deleted_at?: string | null; status?: TaskStatus; id: string; user_id: string; title: string; scheduled_date: string; deadline: string | null; priority: number; category: Category; completed: boolean; project_item_id: string | null; created_at: string }
export interface UserSettings { weekly_priorities?: Record<string,string[]>; monthly_priorities?: Record<string,string[]>; show_routine?: boolean; user_id: string; timezone: string; display_name: string }
export function dateInZone(now = new Date(), zone = 'Asia/Seoul'): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year','month','day'].map(k => parts.find(p => p.type === k)!.value).join('-')
}
export function shiftDate(value: string, days: number): string {
  const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10)
}
export function sortTasks(tasks: Task[]): Task[] { return [...tasks].sort((a,b) => a.priority-b.priority || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) }
export function postpone(task: Task, date: string): Task { return { ...task, scheduled_date: date } }
export const formatDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
export function briefingFor(tasks: Task[], date: string) {
  const planned = sortTasks(tasks.filter(task => !task.deleted_at && task.scheduled_date === date))
  const remaining = planned.filter(task => !task.completed)
  return { planned, remaining, completed: planned.length - remaining.length, highPriority: remaining.filter(task => task.priority === 1).length }
}
export type CalendarMode = 'month' | 'week'
export function calendarDates(anchor: string, mode: CalendarMode): string[] {
  const first = mode === 'month' ? anchor.slice(0, 7) + '-01' : anchor
  const start = shiftDate(first, -new Date(`${first}T12:00:00Z`).getUTCDay())
  return Array.from({length:mode === 'month' ? 42 : 7}, (_, index) => shiftDate(start, index))
}
export function moveCalendar(anchor: string, mode: CalendarMode, direction: number): string {
  if (mode === 'week') return shiftDate(anchor, direction * 7)
  const date = new Date(`${anchor.slice(0,7)}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + direction)
  return date.toISOString().slice(0,10)
}
export function validCategory(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 40
}
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export function taskStatus(task: Task): TaskStatus {
  return task.completed ? 'done' : task.status === 'in_progress' ? 'in_progress' : 'todo'
}
export function withTaskStatus(task: Task, status: TaskStatus): Task {
  return { ...task, status, completed: status === 'done' }
}
export interface RoutineEntry { id: string; user_id: string; title: string; weekdays: number[]; start_time: string; end_time: string; created_at: string }
export function validRoutine(value: unknown): value is RoutineEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<RoutineEntry>
  return typeof entry.id === 'string' && typeof entry.user_id === 'string' && typeof entry.created_at === 'string' && typeof entry.title === 'string' && entry.title.trim().length > 0 && entry.title.length <= 120
    && Array.isArray(entry.weekdays) && entry.weekdays.length > 0 && entry.weekdays.length <= 7 && entry.weekdays.every(day=>Number.isInteger(day)&&day>=0&&day<=6) && new Set(entry.weekdays).size === entry.weekdays.length
    && typeof entry.start_time === 'string' && typeof entry.end_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.start_time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.end_time) && entry.end_time > entry.start_time
}
export function routinesFor(entries: RoutineEntry[], weekday: number) { return entries.filter(entry=>entry.weekdays.includes(weekday)).sort((a,b)=>a.start_time.localeCompare(b.start_time)||a.created_at.localeCompare(b.created_at)) }
export const timeMinutes = (value: string) => Number(value.slice(0,2)) * 60 + Number(value.slice(3,5))
export function routineLayout(entries: RoutineEntry[], weekday: number) {
  const result: {entry:RoutineEntry;lane:number;lanes:number}[]=[]
  let group:RoutineEntry[]=[],groupEnd=-1
  function flush(){
    const ends:number[]=[],placed:{entry:RoutineEntry;lane:number}[]=[]
    for(const entry of group){let lane=ends.findIndex(end=>end<=timeMinutes(entry.start_time));if(lane<0)lane=ends.length;ends[lane]=timeMinutes(entry.end_time);placed.push({entry,lane})}
    result.push(...placed.map(value=>({...value,lanes:ends.length})));group=[]
  }
  for(const entry of routinesFor(entries,weekday)){
    const start=timeMinutes(entry.start_time)
    if(group.length&&start>=groupEnd){flush();groupEnd=-1}
    group.push(entry);groupEnd=Math.max(groupEnd,timeMinutes(entry.end_time))
  }
  flush();return result
}
export function projectWork(itemId: string, tasks: Task[]): Task | undefined {
  return tasks.find(task=>task.id===itemId&&task.project_item_id===itemId) || [...tasks].filter(task=>task.project_item_id===itemId).sort((a,b)=>a.created_at.localeCompare(b.created_at))[0]
}
export function categoryStyle(category: string) {
  const palette=[['#edf6ee','#39734a'],['#f1eef9','#76619c'],['#fcf4e8','#986b32'],['#eaf1fc','#436b9f'],['#e7f4f2','#34786f'],['#fbeef1','#a05d71'],['#fcf0e8','#a06c42'],['#edf0fa','#5b67a0']]
  let index=['취업 준비','학업','개인'].indexOf(category)
  if(index<0){let hash=0;for(const char of category)hash=(hash*31+char.charCodeAt(0))>>>0;index=3+hash%(palette.length-3)}
  const [backgroundColor,color]=palette[index]!
  return {backgroundColor,color}
}
export const MATERIAL_KINDS = ['자소서','포트폴리오','JD','기업 분석','기타'] as const
export interface ProjectMaterial { id:string;user_id:string;project_id:string;title:string;kind:typeof MATERIAL_KINDS[number];content:string;url:string|null;file_name:string|null;file_size:number|null;file_type:string|null;storage_path:string|null;created_at:string;updated_at:string }
export function safeWebUrl(value: string) {
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password}catch{return false}
}
export function attachmentError(file: {name:string;size:number;type:string}) {
 const types:Record<string,string[]>={pdf:['application/pdf'],doc:['application/msword'],docx:['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],txt:['text/plain'],md:['text/markdown','text/plain'],png:['image/png'],jpg:['image/jpeg'],jpeg:['image/jpeg'],webp:['image/webp']}
 const extension=file.name.split('.').pop()?.toLowerCase()||''
 if(!types[extension])return 'PDF, Word 문서, 텍스트, PNG·JPG·WebP 이미지를 선택해 주세요.'
 if(file.size<=0||file.size>10*1024*1024)return '파일 크기는 0보다 크고 10MB 이하여야 합니다.'
 if(file.type&&!types[extension]!.includes(file.type))return '파일 확장자와 형식이 맞는지 확인해 주세요.'
 return ''
}
export function validMonthlyPriorities(value:unknown):value is Record<string,string[]>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 return Object.entries(value).every(([month,entries])=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&Array.isArray(entries)&&entries.length<=3&&entries.every(entry=>typeof entry==='string'&&entry.length<=200))
}

export function validWeeklyPriorities(value:unknown):value is Record<string,string[]>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 return Object.entries(value).every(([week,entries])=>/^\d{4}-\d{2}-\d{2}$/.test(week)&&!Number.isNaN(Date.parse(week+'T12:00:00Z'))&&new Date(week+'T12:00:00Z').toISOString().slice(0,10)===week&&new Date(week+'T12:00:00Z').getUTCDay()===0&&Array.isArray(entries)&&entries.length<=3&&entries.every(entry=>typeof entry==='string'&&entry.length<=200))
}
