export type Stage = '준비' | '진행' | '마감'
export type Category = '취업 준비' | '학업' | '개인'
export interface Project { id: string; user_id: string; title: string; company: string; deadline: string | null; created_at: string }
export interface ProjectItem { id: string; user_id: string; project_id: string; stage: Stage; title: string; content: string; created_at: string }
export interface Task { id: string; user_id: string; title: string; scheduled_date: string; deadline: string | null; priority: number; category: Category; completed: boolean; project_item_id: string | null; created_at: string }
export interface UserSettings { user_id: string; timezone: string; display_name: string }
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
