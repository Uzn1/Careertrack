import { expect, it } from 'vitest'
import { calendarDates, moveCalendar, validCategory, taskOnCalendarDate, postpone, type Task } from '../layers/planner/shared/domain'
it('shows one record from execution through its deadline across month boundaries',()=>{
 const task:Task={id:'period',user_id:'owner',title:'자소서',scheduled_date:'2026-11-29',deadline:'2026-12-02',priority:1,category:'취업 준비',completed:false,project_item_id:null,created_at:''}
 expect(['2026-11-28','2026-11-29','2026-11-30','2026-12-01','2026-12-02','2026-12-03'].filter(date=>taskOnCalendarDate(task,date))).toEqual(['2026-11-29','2026-11-30','2026-12-01','2026-12-02'])
 expect(taskOnCalendarDate({...task,deadline:null},'2026-11-30')).toBe(false)
 expect(taskOnCalendarDate({...task,deleted_at:'2026-11-29T00:00:00Z'},'2026-11-29')).toBe(false)
 const moved=postpone(task,'2026-12-03')
 expect(moved.deadline).toBe('2026-12-02')
 expect(taskOnCalendarDate(moved,'2026-12-03')).toBe(true)
 expect(taskOnCalendarDate(moved,'2026-12-02')).toBe(false)
 expect(taskOnCalendarDate({...task,completed:true},'2026-12-01')).toBe(true)
})
it('builds 42 month cells including leap day',()=>{const days=calendarDates('2028-02-15','month');expect(days).toHaveLength(42);expect(days[0]).toBe('2028-01-30');expect(days).toContain('2028-02-29')})
it('builds a Sunday-to-Saturday week across year boundaries',()=>{expect(calendarDates('2027-01-01','week')).toEqual(['2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02'])})
it('moves by calendar months or seven-day weeks',()=>{expect(moveCalendar('2026-01-31','month',1)).toBe('2026-02-01');expect(moveCalendar('2026-12-31','month',1)).toBe('2027-01-01');expect(moveCalendar('2026-12-31','week',1)).toBe('2027-01-07')})
it('accepts custom category names while rejecting blank or oversized names',()=>{expect(validCategory('자격증')).toBe(true);expect(validCategory('  ')).toBe(false);expect(validCategory('가'.repeat(41))).toBe(false)})
it('uses consistent category colors and distinguishes custom categories from default types',async()=>{const {categoryStyle}=await import('../layers/planner/shared/domain');expect(categoryStyle('취업 준비')).not.toEqual(categoryStyle('학업'));expect(categoryStyle('자격증')).not.toEqual(categoryStyle('취업 준비'));expect(categoryStyle('자격증')).toEqual(categoryStyle('자격증'))})

it('validates optional weekly priorities using real Sunday dates across year boundaries',async()=>{const {validWeeklyPriorities}=await import('../layers/planner/shared/domain');expect(validWeeklyPriorities({'2026-12-27':[]})).toBe(true);expect(validWeeklyPriorities({'2026-11-19':['목요일']})).toBe(false);expect(validWeeklyPriorities({'2026-02-29':[]})).toBe(false);expect(validWeeklyPriorities({'2026-11-15':['1','2','3','4']})).toBe(false);expect(validWeeklyPriorities({'2026-11-15':['가'.repeat(201)]})).toBe(false)})
