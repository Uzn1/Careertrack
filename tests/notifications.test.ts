import {expect,it} from 'vitest'
import {scheduleNotification,type RoutineEntry,type Task} from '../layers/planner/shared/domain'
const routine:RoutineEntry={id:'yoga',user_id:'owner',title:'요가',weekdays:[5],start_time:'19:00',end_time:'20:00',created_at:''}
const tomorrow:Task={id:'task',user_id:'owner',title:'준비',scheduled_date:'2026-11-21',deadline:null,priority:1,category:'개인',completed:false,project_item_id:null,created_at:''}
it('shows only schedules starting within the next thirty minutes, including the boundary',()=>{
 expect(scheduleNotification([],[routine],new Date('2026-11-20T09:29:00Z'),'Asia/Seoul').kind).toBe('none')
 expect(scheduleNotification([],[routine],new Date('2026-11-20T09:30:00Z'),'Asia/Seoul').routines).toEqual([routine])
 expect(scheduleNotification([],[routine],new Date('2026-11-20T10:00:00Z'),'Asia/Seoul').kind).toBe('today')
 expect(scheduleNotification([],[routine],new Date('2026-11-20T10:01:00Z'),'Asia/Seoul').kind).toBe('none')
})
it('switches to tomorrow at 20:00 only when no remaining schedule exists today',()=>{
 expect(scheduleNotification([tomorrow],[],new Date('2026-11-20T10:59:00Z'),'Asia/Seoul').kind).toBe('none')
 const next=scheduleNotification([tomorrow],[routine],new Date('2026-11-20T11:00:00Z'),'Asia/Seoul')
 expect(next).toMatchObject({kind:'tomorrow',date:'2026-11-21',tasks:[tomorrow]})
 expect(scheduleNotification([tomorrow],[{...routine,start_time:'23:00',end_time:'24:00'}],new Date('2026-11-20T11:00:00Z'),'Asia/Seoul').kind).toBe('none')
})
it('uses the configured timezone and tomorrow weekday rather than the device timezone',()=>{
 const now=new Date('2026-11-20T11:00:00Z')
 const saturday={...routine,weekdays:[6]}
 expect(scheduleNotification([], [saturday],now,'Asia/Seoul')).toMatchObject({kind:'tomorrow',routines:[saturday]})
 expect(scheduleNotification([], [saturday],now,'America/New_York').kind).toBe('none')
})
it('excludes completed and deleted tasks from tomorrow notifications',()=>{
 const result=scheduleNotification([{...tomorrow,completed:true},{...tomorrow,id:'deleted',deleted_at:'2026-11-20T00:00:00Z'}],[],new Date('2026-11-20T11:00:00Z'),'Asia/Seoul')
 expect(result.tasks).toEqual([])
})
