<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Maximize2, Minimize2, GripVertical } from 'lucide-vue-next'
import { calendarDates, moveCalendar, categoryStyle, sortTasks, taskOnCalendarDate, formatDate, type Task, type CalendarMode } from '../../shared/domain'
const props = defineProps<{ modelValue: string; mode: CalendarMode; tasks: Task[]; today: string; overview?: boolean; expandable?:boolean; expanded?:boolean; weeklyPriorities?:Record<string,string[]>; busy?:boolean; savePriorities?:(week:string,values:string[])=>Promise<boolean> }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'update:mode': [mode: CalendarMode]; open: [date: string]; move:[task:Task,date:string]; expand:[] }>()
const dragging=ref(''),dropDate=ref('')
const cursor = ref(props.modelValue)
const editingWeeks=reactive<Record<string,boolean>>({})
const priorityDrafts=reactive<Record<string,string[]>>({})
const priorityWeek=computed(()=>calendarDates(cursor.value,'week')[0]!)
const dirtyWeeks=reactive<Record<string,boolean>>({})
watch([priorityWeek,()=>props.weeklyPriorities],()=>{
 const week=priorityWeek.value
 if(!dirtyWeeks[week])priorityDrafts[week]=Array.from({length:3},(_,index)=>props.weeklyPriorities?.[week]?.[index]||'')
},{immediate:true,deep:true})
const priorityDraft=computed(()=>priorityDrafts[priorityWeek.value]||['','',''])
const editingPriorities=computed(()=>editingWeeks[priorityWeek.value]??!Object.hasOwn(props.weeklyPriorities||{},priorityWeek.value))
async function submitPriorities(){
 if(props.busy||!props.savePriorities)return
 const week=priorityWeek.value
 if(await props.savePriorities(week,[...priorityDraft.value])){dirtyWeeks[week]=false;editingWeeks[week]=false}
}
function editPriorities(){
 const week=priorityWeek.value
 priorityDrafts[week]=Array.from({length:3},(_,index)=>props.weeklyPriorities?.[week]?.[index]||'')
 editingWeeks[week]=true
}
const priorityRange=computed(()=>{const days=calendarDates(cursor.value,'week');return `${days[0]!.slice(5).replace('-','.')} – ${days[6]!.slice(5).replace('-','.')}`})
watch(() => props.modelValue, value => { cursor.value = value })
const categories=computed(()=>[...new Set(['취업 준비','학업','개인',...props.tasks.map(task=>task.category)])])
const entryLimit=computed(()=>props.expanded?6:props.mode==='week'?4:2)
const cells = computed(() => calendarDates(cursor.value, props.mode))
const title = computed(() => props.mode === 'month'
  ? `${cursor.value.slice(0,4)}년 ${Number(cursor.value.slice(5,7))}월`
  : `${cells.value[0]!.replaceAll('-','.')} – ${cells.value[6]!.slice(5).replace('-','.')}`)
function pick(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return
  emit('update:modelValue', value)
}
function changeMode(value: CalendarMode) { cursor.value=props.modelValue; emit('update:mode', value) }
let pointer: {id:number;x:number;y:number;task:Task;moved:boolean}|undefined
let suppressBlockClick=false
function startDrag(event:PointerEvent,task:Task){
 if(props.busy||event.button!==0)return
 pointer={id:event.pointerId,x:event.clientX,y:event.clientY,task,moved:false}
 suppressBlockClick=false
 ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function moveDrag(event:PointerEvent){
 if(!pointer||pointer.id!==event.pointerId)return
 if(!pointer.moved&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<6)return
 pointer.moved=true;dragging.value=pointer.task.id
 const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('.calendar-cell')
 dropDate.value=target?.closest('.calendar-panel')===(event.currentTarget as HTMLElement).closest('.calendar-panel')?target?.dataset.date||'':''
}
function endDrag(event:PointerEvent){
 if(!pointer||pointer.id!==event.pointerId)return
 const {task,moved}=pointer,date=dropDate.value
 pointer=undefined;dragging.value='';dropDate.value='';suppressBlockClick=moved
 if(moved){event.preventDefault();if(!props.busy&&date&&task.scheduled_date!==date)emit('move',task,date)}
}
function cancelDrag(){pointer=undefined;dragging.value='';dropDate.value='';suppressBlockClick=true}
function clickBlock(date:string){if(suppressBlockClick){suppressBlockClick=false;return}pick(date);if(props.overview)emit('open',date)}
const entries = (date: string) => sortTasks(props.tasks.filter(task => taskOnCalendarDate(task,date)))
</script>
<template>
  <section class="calendar-panel panel" :class="{weekly:mode==='week','overview-calendar':overview,'expanded-calendar':expanded}" aria-label="일정 달력">
    <div v-if="overview" class="overview-calendar-heading"><h2><CalendarDays :size="20" />나의 일정</h2><p>오늘의 할 일 아래에서 한 달과 한 주를 함께 살펴보세요.</p></div>
    <div class="calendar-controls"><div class="calendar-heading"><h2>{{ title }}</h2><div><button class="icon-button" :aria-label="mode==='month'?'이전 달':'이전 주'" @click="cursor=moveCalendar(cursor,mode,-1)"><ChevronLeft :size="19" /></button><button class="text-button" @click="pick(today);cursor=today">오늘</button><button class="icon-button" :aria-label="mode==='month'?'다음 달':'다음 주'" @click="cursor=moveCalendar(cursor,mode,1)"><ChevronRight :size="19" /></button></div></div><button v-if="expandable" type="button" class="outline-button calendar-expand" :aria-pressed="expanded" aria-controls="calendar-day-tasks" @click="emit('expand')"><Minimize2 v-if="expanded" :size="16" /><Maximize2 v-else :size="16" />{{ expanded?'일정 함께 보기':'달력만 보기' }}</button><div class="calendar-mode" role="group" aria-label="달력 표시 방식"><button :aria-pressed="mode==='month'" @click="changeMode('month')">월별</button><button :aria-pressed="mode==='week'" @click="changeMode('week')">주간</button></div></div>
    <details v-if="overview" class="weekly-priorities-option"><summary>주간 우선순위 <span class="optional">선택</span></summary><p class="muted">{{ priorityRange }} · 필요한 주에만 최대 3개를 적어보세요. 비워 두어도 괜찮아요.</p><form class="monthly-priorities" @submit.prevent="submitPriorities"><div><h3>이번 주에 집중할 일</h3><button v-if="editingPriorities" class="text-button" :disabled="busy">{{ busy?'저장 중…':'저장' }}</button><button v-else type="button" class="icon-button" aria-label="주간 우선순위 수정" :disabled="busy" @click="editPriorities"><Pencil :size="17" /></button></div><template v-if="editingPriorities"><label v-for="index in 3" :key="index"><span>{{ index }}</span><input v-model="priorityDraft[index-1]" :disabled="busy" :aria-label="index+'번째 주간 우선순위'" maxlength="200" :placeholder="['이번 주 가장 중요한 한 가지','두 번째로 집중할 일','마지막으로 챙길 일'][index-1]" @input="dirtyWeeks[priorityWeek]=true"></label></template><div v-else class="saved-priorities"><div v-for="index in 3" :key="index" class="saved-priority"><span>{{ index }}</span><p>{{ weeklyPriorities?.[priorityWeek]?.[index-1] || '—' }}</p></div></div></form></details>
    <label class="date-jump">날짜 바로 선택<input :value="modelValue" type="date" @change="pick(($event.target as HTMLInputElement).value)"></label>
    <div class="calendar-week"><span v-for="weekday in ['일','월','화','수','목','금','토']" :key="weekday">{{ weekday }}</span></div>
    <div class="calendar-grid"><div v-for="cell in cells" :key="cell" class="calendar-cell" role="button" tabindex="0" :data-date="cell" :class="{selected:cell===modelValue,outside:mode==='month'&&!cell.startsWith(cursor.slice(0,7)),istoday:cell===today,'calendar-drop-target':dropDate===cell&&Boolean(dragging)}" :aria-label="`${cell} 할 일 ${entries(cell).length}개`" :aria-pressed="cell===modelValue" @click="!dragging&&(pick(cell),overview&&emit('open',cell))" @keydown.enter.self.prevent="pick(cell);overview&&emit('open',cell)" @keydown.space.self.prevent="pick(cell);overview&&emit('open',cell)"><span class="date-number">{{ mode==='week' ? formatDate(cell) : Number(cell.slice(8)) }}</span><div v-for="task in entries(cell).slice(0,entryLimit)" :key="task.id" class="calendar-task" :style="categoryStyle(task.category)" :title="task.category+' · '+task.title+' · 실행 '+task.scheduled_date+(task.deadline?' / 마감 '+task.deadline:'')+' · 다른 날짜로 드래그하여 수정'" :class="{academic:task.category==='학업',done:task.completed}" @pointerdown.stop="startDrag($event,task)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="cancelDrag" @click.stop="clickBlock(cell)"><GripVertical :size="10" aria-hidden="true" /><span>{{ task.completed ? '✓ ' : '' }}{{ task.title }}</span></div><span v-if="entries(cell).length>entryLimit" class="calendar-more">+{{ entries(cell).length-entryLimit }}개</span></div></div>
    <p class="calendar-drag-note">블록을 다른 날짜로 끌어 수정할 수 있어요. 마감일이 있으면 그날까지 표시됩니다.</p>
    <div class="calendar-legend" aria-label="분류별 색상"><span v-for="category in categories" :key="category" class="category" :style="categoryStyle(category)">{{ category }}</span></div>
  </section>
</template>
<style scoped>
.calendar-expand{font-size:12px;min-height:36px;padding:0 13px}.expanded-calendar .calendar-grid>.calendar-cell{min-height:125px}.expanded-calendar .calendar-task{font-size:12px;padding:4px}

.weekly .calendar-grid>.calendar-cell{display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch}.weekly .date-number{flex-shrink:0;min-height:38px;align-self:stretch;margin-bottom:8px}

.calendar-cell{cursor:pointer}.calendar-task{display:flex;align-items:center;gap:3px}.calendar-task>span{min-width:0;overflow:hidden;text-overflow:ellipsis}.calendar-task>*{pointer-events:none}.calendar-task{cursor:grab;user-select:none;touch-action:none}.calendar-task:active{cursor:grabbing}.calendar-grid>.calendar-cell.calendar-drop-target{outline:2px dashed var(--brand);outline-offset:-3px;background:var(--mint)}.calendar-drag-note{font-size:12px;line-height:1.8;color:var(--muted);margin-top:16px}

.saved-priorities{display:grid}.saved-priority{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid #e7eddf;font-size:14px}.saved-priority>span{background:#e7efdf;color:#789960;font-size:12px;border-radius:5px;padding:2px 6px}.saved-priority p{overflow-wrap:anywhere;line-height:1.6;white-space:pre-wrap}

.weekly-priorities-option{margin:18px 0 24px}.weekly-priorities-option summary{cursor:pointer;color:var(--green);font-weight:700}.weekly-priorities-option>p{font-size:13px;margin-top:12px}.weekly-priorities-option .monthly-priorities{margin-top:12px}

.overview-calendar{margin-top:32px}.overview-calendar-heading{margin-bottom:24px}.overview-calendar-heading h2{display:flex;gap:8px;align-items:center}.overview-calendar-heading p{font-size:14px;color:#7d8978;margin-top:9px;line-height:1.8}.calendar-controls{display:flex;gap:18px;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap}.calendar-heading{margin:0;gap:14px;flex:1}.calendar-mode{display:flex;background:#f0f3ed;border:1px solid var(--line);border-radius:9px;padding:3px}.calendar-mode button{font-size:14px;border-radius:6px;padding:7px 17px;color:#86917e}.calendar-mode button[aria-pressed=true]{background:white;color:var(--green);box-shadow:0 2px 5px #263b2210;font-weight:700}.calendar-bottom{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:20px;font-size:14px;color:#7d8978}.calendar-bottom button{font-size:13px}.weekly .calendar-grid>.calendar-cell{min-height:190px}.weekly .date-number{width:auto;border-radius:5px;font-size:12px;height:auto;min-height:28px;line-height:1.7;padding:3px}.weekly .calendar-task{font-size:12px;white-space:normal;overflow-wrap:anywhere;line-height:1.8;margin-top:7px;padding:5px}.overview-calendar .calendar-grid>.calendar-cell{min-height:115px}.overview-calendar .calendar-task{font-size:13px;padding:5px}.overview-calendar.weekly .calendar-grid>.calendar-cell{min-height:200px}
@media(max-width:767px){.calendar-controls{align-items:flex-start;gap:13px}.calendar-heading{flex-basis:100%}.calendar-heading h2{font-size:16px}.calendar-mode button{padding:7px 20px}.calendar-bottom{align-items:flex-start;flex-direction:column;font-size:13px}.calendar-bottom button{align-self:flex-end}.weekly .calendar-week{display:none}.weekly .calendar-grid{grid-template-columns:1fr}.weekly .calendar-grid>.calendar-cell,.overview-calendar.weekly .calendar-grid>.calendar-cell{min-height:90px;padding:10px}.weekly .date-number{font-size:14px;justify-content:start;width:fit-content;padding:3px 8px}.weekly .calendar-task{font-size:14px}.overview-calendar .calendar-grid>.calendar-cell{min-height:75px}.overview-calendar:not(.weekly) .calendar-task{font-size:10px;padding:3px}.overview-calendar-heading p{font-size:13px}}
</style>
