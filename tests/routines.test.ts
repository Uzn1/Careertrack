import { expect, it } from 'vitest'
import { routinesFor, validRoutine, type RoutineEntry } from '../layers/planner/shared/domain'
import { emptyData, parseLocal } from '../layers/planner/shared/storage'
const routine:RoutineEntry={id:'r1',user_id:'demo',title:'영어 공부',weekdays:[1,3,5],start_time:'09:00',end_time:'10:00',created_at:'2026-11-19T00:00:00Z'}
it('validates days and same-day time intervals',()=>{expect(validRoutine(routine)).toBe(true);expect(validRoutine({...routine,weekdays:[]})).toBe(false);expect(validRoutine({...routine,weekdays:[8]})).toBe(false);expect(validRoutine({...routine,end_time:'08:00'})).toBe(false);expect(validRoutine({...routine,start_time:'25:00'})).toBe(false)})
it('shows only the selected weekday in chronological order',()=>{expect(routinesFor([routine,{...routine,id:'r2',start_time:'08:00',end_time:'09:00'}],1).map(entry=>entry.id)).toEqual(['r2','r1']);expect(routinesFor([routine],2)).toEqual([])})
it('reads older saved data without routines and preserves existing task storage',()=>{const {routines,...legacy}=emptyData();expect(routines).toEqual([]);expect(parseLocal(JSON.stringify(legacy)).routines).toEqual([]);expect(parseLocal(JSON.stringify({...emptyData(),routines:[routine],settings:{...emptyData().settings,show_routine:true}})).routines).toEqual([routine])})
it('lays overlapping routines side by side and frees lanes for later blocks',async()=>{
 const {routineLayout}=await import('../layers/planner/shared/domain')
 const rows=[routine,{...routine,id:'overlap',start_time:'09:30',end_time:'10:30'},{...routine,id:'later',start_time:'11:00',end_time:'12:00'}]
 const placed=routineLayout(rows,1)
 expect(placed.map(value=>[value.entry.id,value.lane,value.lanes])).toEqual([['r1',0,2],['overlap',1,2],['later',0,1]])
 expect(routineLayout(rows,2)).toEqual([])
})
