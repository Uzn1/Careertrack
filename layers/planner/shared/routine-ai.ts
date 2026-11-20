import { validRoutine, type RoutineEntry } from './domain'

export interface RoutineSuggestion { source?: 'rules'; action?: 'remove'; title: string; weekdays: number[]; start_time: string; end_time: string }

export function readRoutineSuggestion(value: unknown): RoutineSuggestion {
  if (!value || typeof value !== 'object') throw new Error('시간표를 해석하지 못했습니다. 요일과 시작·종료 시간을 적어 주세요.')
  const routine = value as Record<string, unknown>
  if (routine.action !== undefined && routine.action !== 'add' && routine.action !== 'remove') throw new Error('지원하지 않는 시간표 요청입니다.')
  const removal = routine.action === 'remove'
  const missingStart = removal && (routine.start_time === null || routine.start_time === '')
  const missingDays = removal && Array.isArray(routine.weekdays) && !routine.weekdays.length
  const missingEnd = routine.end_time === null || routine.end_time === ''
  const candidate = { id: '', user_id: '', created_at: '', title: routine.title, weekdays: missingDays ? [0] : routine.weekdays, start_time: missingStart ? '00:00' : routine.start_time, end_time: missingEnd ? '24:00' : routine.end_time }
  if (!validRoutine(candidate)) throw new Error('요일과 시작·종료 시간을 확인해 주세요. 예: 월화수 09:00~10:00에 기출 풀기')
  const source = routine.source === 'rules' ? {source:'rules' as const} : {}
  if (removal) return { ...source, action: 'remove', title: candidate.title, weekdays: missingDays ? [] : candidate.weekdays, start_time: missingStart ? '' : candidate.start_time, end_time: missingEnd ? '' : candidate.end_time }
  return { ...source, title: candidate.title, weekdays: candidate.weekdays, start_time: candidate.start_time, end_time: missingEnd ? '' : candidate.end_time }
}

// Only explicit day/time commands qualify when the external provider is unavailable.
export function parseExplicitRoutine(text:string):RoutineSuggestion|null {
 const input=text.trim()
 if(!input||input.length>500||/[\n;]|그리고|말고|빼고|제외|아니|대신|하지|다음\s*주|이번\s*주|내일|오늘/.test(input))return null
 const remove=/\s*(?:제거|삭제|취소)(?:해\s*줘(?:요)?|해\s*주세요)?[.!]?$/
 const removing=remove.test(input)
 let rest=removing?input.replace(remove,'').trim():input
 const days=rest.match(/^(매일|평일|주말|[월화수목금토일](?:요일)?(?:[,\s·/]*[월화수목금토일](?:요일)?)*)\s*(?:에\s*|\s+)/)
 const weekdays=days?days[1]==='매일'?[0,1,2,3,4,5,6]:days[1]==='평일'?[1,2,3,4,5]:days[1]==='주말'?[0,6]:[...new Set([...days[1]!.replaceAll('요일','')].filter(day=>'일월화수목금토'.includes(day)).map(day=>'일월화수목금토'.indexOf(day)))]:[]
 if(days)rest=rest.slice(days[0].length).trim()
 if(!removing&&!days)return null
 function takeTime(value:string,end=false){
  const match=value.match(/^(오전|오후)?\s*(\d{1,2})(?::(\d{2})|시(?:\s*(\d{1,2})분)?)\s*/)
  if(!match)return null
  let hour=Number(match[2]);const minute=Number(match[3]||match[4]||0)
  if(match[1]){if(hour<1||hour>12)return null;hour=hour%12+(match[1]==='오후'?12:0)}
  if(minute>59||hour>(end?24:23)||(hour===24&&minute!==0))return null
  return {time:String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0'),rest:value.slice(match[0].length)}
 }
 let start_time='',end_time=''
 const start=takeTime(rest)
 if(start){
  start_time=start.time;rest=start.rest
  const separator=rest.match(/^(?:~|～|-|–|부터)\s*/)
  if(separator){const end=takeTime(rest.slice(separator[0].length),true);if(!end)return null;end_time=end.time;rest=end.rest.replace(/^까지\s*/,'')}
  rest=rest.replace(/^에\s*/,'')
 }else if(!removing)return null
 const title=rest.replace(/\s*(?:추가|등록)(?:해\s*줘(?:요)?|해\s*주세요)?[.!]?$/,'').trim()
 if(!title||/[,~～]|\d\s*(?:시|:)|추가|등록|수정|변경|제거|삭제|취소/.test(title))return null
 try{return readRoutineSuggestion({source:'rules',action:removing?'remove':'add',title,weekdays,start_time,end_time})}catch{return null}
}

export interface RoutineRemoval { entry:RoutineEntry; remainingWeekdays:number[] }
export function routineRemovalMatches(entries:RoutineEntry[],request:RoutineSuggestion):RoutineRemoval[]{
 if(request.action!=='remove')return []
 const normalize=(value:string)=>value.replace(/\s+/g,'').toLocaleLowerCase()
 return entries.filter(entry=>normalize(entry.title)===normalize(request.title)&&(!request.start_time||entry.start_time===request.start_time)&&(!request.end_time||entry.end_time===request.end_time))
  .map(entry=>({entry,remainingWeekdays:request.weekdays.length?entry.weekdays.filter(day=>!request.weekdays.includes(day)):[]}))
  .filter(row=>row.remainingWeekdays.length!==row.entry.weekdays.length)
}
