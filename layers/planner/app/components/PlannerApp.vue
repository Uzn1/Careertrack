<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useHead, useRuntimeConfig } from '#imports'
import { ArrowUpRight, Bell, Trash2, House, FileText, ChevronLeft, Plus, Sun, CalendarDays, FolderOpen, Sparkles, Search, Settings2, Check, X, LogOut, Menu, ListTodo, RefreshCw, CircleHelp, Leaf } from 'lucide-vue-next'
import { usePlanner } from '../composables/usePlanner'
import { routineRemovalMatches, type RoutineRemoval } from '../../shared/routine-ai'
import { formatDate, shiftDate, postpone, todaySummary, projectsOnDate, taskOnCalendarDate, orderedProjects, categoryStyle, projectWork, taskStatus, withTaskStatus, type TaskStatus, type CalendarMode, MATERIAL_KINDS, attachmentError, type ProjectMaterial, ROUTINE_COLORS, type RoutineEntry, type Task, type Project, type ProjectItem, type Stage } from '../../shared/domain'
useHead({title:'CareerTrack · 커리어 플래너'})
const planner = usePlanner()
const { materials, routines, trash, recovery, tasks, projects, items, user, demo, busy, loading, error, notice, today, settings, notification, configured, ordered } = planner
const variant = String(useRuntimeConfig().public.variant)
const featureStage = Number(useRuntimeConfig().public.featureStage)
const view = ref('home')
const selected = ref(today.value), search = ref(''), filter = ref('전체'), mobileNav = ref(false)
const calendarExpanded=ref(false)
const overviewDate=ref(today.value), calendarMode=ref<CalendarMode>('month'), customCategory=ref('')
const categoryOptions=computed(()=>[...new Set(['취업 준비','학업','개인',...tasks.value.map(task=>task.category)])])
const taskProjectId=ref(''), taskStage=ref<Stage>('준비'), editingTask=ref(false)
const projectTab=ref<'work'|'materials'>('work')
const materialFile=ref<File|undefined>()
const materialDraft=reactive({id:'',title:'',kind:'자소서' as typeof MATERIAL_KINDS[number],content:'',url:''})
const selectedProject = ref(''), dialog = ref(''), authMode = ref('login')
const dialogElement = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
const authForm = reactive({ email: '', password: '' })
const draftTask = reactive({ id:'', status:'todo' as TaskStatus, title:'', scheduled_date:'', deadline:'', priority:2, category:'취업 준비', project_item_id:'' })
const routineRemovals=ref<RoutineRemoval[]>([])
const weekdayLabels=['일','월','화','수','목','금','토']
const routinePrompt=ref(''),routineNeedsEnd=ref(false),routineUsingRules=ref(false)
const routineDraft=reactive({color:'green',id:'',title:'',weekdays:[1,2,3,4,5] as number[],start_time:'09:00',end_time:'10:00'})
const draftProject = reactive({ id:'', title:'', company:'', start_date:'', deadline:'' })
const draftItem = reactive({ id:'', project_id:'', title:'', stage:'준비' as Stage, content:'', deadline:'', scheduled_date:'' })
const permanentTarget=ref<Task|null>(null)
const postponed = ref<Task | null>(null), nextDate = ref('')
const timezone = ref('Asia/Seoul'), displayName = ref('')
const active = computed(() => demo.value || !!user.value)
const activeProjects=computed(()=>orderedProjects(projects.value.filter(project=>!project.archived_at)))

const chosenProject = computed(() => selectedProject.value?projects.value.find(p => p.id === selectedProject.value):projects.value[0])
const day = computed(() => view.value === 'calendar' ? selected.value : today.value)
const notificationCount=computed(()=>notification.value.routines.length+notification.value.tasks.length)
const notificationTitle=computed(()=>notification.value.kind==='today'?'오늘 시간표 알림':notification.value.kind==='tomorrow'?'내일 일정 알림':'일정 알림')
const bannerError=ref('')
watch(error,(value,_old,onCleanup)=>{bannerError.value=value;if(!value)return;const timer=setTimeout(()=>{bannerError.value=''},3000);onCleanup(()=>clearTimeout(timer))},{immediate:true})
const dayTasks = computed(() => ordered.value.filter(t => view.value==='calendar' ? taskOnCalendarDate(t,day.value) : t.scheduled_date===day.value))
const visibleTasks = computed(() => dayTasks.value.filter(t => (filter.value === '전체' || t.category === filter.value) && (!search.value || t.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))))
const pending = computed(() => visibleTasks.value.filter(task=>!task.completed)), completed = computed(() => visibleTasks.value.filter(t => t.completed))
const taskContexts=computed(()=>Object.fromEntries(tasks.value.map(task=>[task.id,context(task)||''])))
const homeTasks=computed(()=>[...pending.value,...completed.value])
const homeTitle = computed(()=>settings.value.display_name.trim() ? `${settings.value.display_name.trim()}님의 계획입니다.` : '나의 계획입니다.')
const todayProjects = computed(()=>projectsOnDate(projects.value,items.value,tasks.value,today.value))
const homeSummary = computed(()=>todaySummary(tasks.value,today.value))
const allToday = computed(() => tasks.value.filter(t => t.scheduled_date === today.value))
const doneToday = computed(() => allToday.value.filter(t => t.completed).length)
const progress = computed(() => allToday.value.length ? Math.round(doneToday.value / allToday.value.length * 100) : 0)
const stageList: Stage[] = ['준비','진행','마감']
const nav = [{id:'home',label:'홈',icon:House},{id:'today',label:'오늘 할 일',icon:Sun},{id:'projects',label:'취업 관리',icon:FolderOpen}]
const sectionLabel = computed(()=>view.value==='project'?'취업 관리 · '+(chosenProject.value?.title||'프로젝트'):view.value==='calendar'?'오늘 할 일 · 날짜별 일정':nav.find(n=>n.id===view.value)?.label)
function go(id:string) {
 if(!['home','today','projects','project','calendar'].includes(id))return
 view.value=id;search.value='';mobileNav.value=false
 const params=new URLSearchParams({view:id})
 if(id==='project'&&selectedProject.value){params.set('project',selectedProject.value);params.set('tab',projectTab.value)}
 if(id==='calendar')params.set('date',selected.value)
 history.pushState(null,'','?'+params.toString())
}
function openProjectPage(id:string,tab:'work'|'materials'='work'){selectedProject.value=id;projectTab.value=tab;go('project')}
function openMaterial(material?:ProjectMaterial){
 if(!requireActive()||!chosenProject.value)return
 materialFile.value=undefined
 Object.assign(materialDraft,material?{id:material.id,title:material.title,kind:material.kind,content:material.content,url:material.url||''}:{id:crypto.randomUUID(),title:'',kind:'자소서',content:'',url:''})
 dialog.value='material'
}
function selectMaterialFile(event:Event){
 const input=event.target as HTMLInputElement,file=input.files?.[0]
 if(!file){materialFile.value=undefined;return}
 const issue=attachmentError(file)
 if(issue){error.value=issue;input.value='';materialFile.value=undefined;return}
 error.value='';materialFile.value=file
 if(!materialDraft.title.trim())materialDraft.title=file.name.replace(/\.[^.]+$/,'').slice(0,200)
}
async function submitMaterial(){
 if(!requireActive()||!chosenProject.value)return
 const old=materials.value.find(material=>material.id===materialDraft.id)
 const material:ProjectMaterial={...(old||{...planner.stamp(),id:materialDraft.id,file_name:null,file_size:null,file_type:null,storage_path:null}),project_id:chosenProject.value.id,title:materialDraft.title.trim(),kind:materialDraft.kind,content:materialDraft.content,url:materialDraft.url.trim()||null,updated_at:new Date().toISOString()}
 if(await planner.run(()=>planner.saveMaterial(material,materialFile.value)))dialog.value=''
}
function context(task:Task) { const item=items.value.find(i=>i.id===task.project_item_id); return item ? projects.value.find(p=>p.id===item.project_id)?.title : undefined }
function openProject(task:Task) { const item=items.value.find(i=>i.id===task.project_item_id); if(item) { openProjectPage(item.project_id) } }
function requireActive() { if (!active.value) { dialog.value='auth'; return false } return true }
function editTask(task?:Task) {
 if(!requireActive())return
 customCategory.value='';editingTask.value=Boolean(task)
 Object.assign(draftTask,task?{...task,status:taskStatus(task),deadline:task.deadline||'',project_item_id:task.project_item_id||''}:{id:crypto.randomUUID(),status:'todo',title:'',scheduled_date:day.value,deadline:'',priority:2,category:'취업 준비',project_item_id:''})
 const item=items.value.find(item=>item.id===task?.project_item_id)
 taskProjectId.value=item?.project_id||'';taskStage.value=item?.stage||'준비';dialog.value='task'
}
function editCalendarTask(task:Task,date:string){
 editTask(task)
 if(dialog.value==='task')draftTask.scheduled_date=date
}
async function confirmPermanentDelete(){
 if(permanentTarget.value&&await planner.permanentlyDeleteTask(permanentTarget.value)){permanentTarget.value=null;dialog.value='trash'}
}
async function submitTask(){
 if(!requireActive())return
 const existing=tasks.value.find(task=>task.id===draftTask.id)
 const value:Task=withTaskStatus({...(existing||{...planner.stamp(),id:draftTask.id}),title:draftTask.title.trim(),scheduled_date:draftTask.scheduled_date,deadline:draftTask.deadline||null,priority:Number(draftTask.priority),category:(draftTask.category==='__custom'?customCategory.value:draftTask.category).trim(),project_item_id:taskProjectId.value?(draftTask.project_item_id||draftTask.id):null,completed:existing?.completed||false},draftTask.status)
 if(!value.title)return
 if(value.deadline&&value.deadline<value.scheduled_date){error.value='마감일은 실행 예정일과 같거나 그 이후여야 합니다.';return}
 const ok=await planner.run(async()=>{
  if(taskProjectId.value&&!draftTask.project_item_id){
    const old=items.value.find(item=>item.id===value.id)
    const item:ProjectItem={...(old||{...planner.stamp(),id:value.id}),project_id:taskProjectId.value,title:value.title,stage:taskStage.value,content:old?.content||'',deadline:value.deadline}
    await planner.saveProjectWork(item,value)
  }else await planner.save('tasks',value)
 })
 if(ok){selected.value=value.scheduled_date;dialog.value=''}
}
async function toggle(task:Task) { await planner.run(()=>planner.save('tasks',withTaskStatus(task,task.completed?'todo':'done'))) }
async function moveStatus(task:Task,status:TaskStatus){if(await planner.run(()=>planner.save('tasks',withTaskStatus(task,status))))notice.value=task.title+' · '+({todo:'할 일',in_progress:'진행 중',done:'완료'}[status])+' 상태로 옮겼습니다.'}
function askPostpone(task:Task) { postponed.value=task;nextDate.value=shiftDate(task.scheduled_date,1);dialog.value='postpone' }
async function submitPostpone(){if(postponed.value && await planner.run(()=>planner.save('tasks',postpone(postponed.value!,nextDate.value)))) {dialog.value='';notice.value=nextDate.value+' 날짜로 옮겼습니다. 마감일과 프로젝트 연결은 유지됩니다.'} }
function editProject(project?:Project){if(!requireActive())return;Object.assign(draftProject,project ? {...project,start_date:project.start_date||'',deadline:project.deadline||''} : {id:'',title:'',company:'',start_date:'',deadline:''});dialog.value='project'}
async function submitProject(){if(!requireActive())return;const old=projects.value.find(p=>p.id===draftProject.id);const value={...(old||planner.stamp()),title:draftProject.title.trim(),company:draftProject.company.trim(),start_date:draftProject.start_date||null,deadline:draftProject.deadline||null};if(!value.title)return;if(await planner.run(()=>planner.save('projects',value))){dialog.value='';openProjectPage(value.id,old?projectTab.value:'work')}}
function itemWork(item:ProjectItem){return projectWork(item.id,[...tasks.value,...trash.value])}
function itemTitle(item:ProjectItem){const work=itemWork(item);return work?.id===item.id?work.title:item.title}
function itemDeadline(item:ProjectItem){const work=itemWork(item);return work?work.deadline:item.deadline}
function editItem(stage:Stage,item?:ProjectItem){
 if(!requireActive()||!chosenProject.value)return
 const work=item?itemWork(item):undefined
 Object.assign(draftItem,item?{...item,title:itemTitle(item),scheduled_date:work?.scheduled_date||item.deadline||today.value,deadline:work?(work.deadline||''):(item.deadline||'')}:{id:crypto.randomUUID(),project_id:chosenProject.value.id,title:'',stage,content:'',scheduled_date:today.value,deadline:''})
 dialog.value='item'
}
async function submitItem(){
 if(!requireActive())return
 const old=items.value.find(item=>item.id===draftItem.id)
 const item:ProjectItem={...(old||{...planner.stamp(),id:draftItem.id}),project_id:draftItem.project_id,title:draftItem.title.trim(),stage:draftItem.stage,content:draftItem.content,deadline:draftItem.deadline||null}
 const current=old?itemWork(old):undefined
 const task:Task={...(current||{...planner.stamp(),id:item.id}),title:current&&current.id!==item.id?current.title:item.title,scheduled_date:draftItem.scheduled_date,deadline:draftItem.deadline||null,priority:current?.priority||2,category:current?.category||'취업 준비',completed:current?.completed||false,project_item_id:item.id}
 if(await planner.run(()=>planner.saveProjectWork(item,task)))dialog.value=''
}
function addLinkedTask(item:ProjectItem){const work=itemWork(item);if(work){editTask(work);return}editTask();taskProjectId.value=item.project_id;draftTask.project_item_id=item.id;draftTask.title=itemTitle(item);draftTask.deadline=itemDeadline(item)||''}

function startDemo(){planner.startDemo();dialog.value=''}
function editRoutine(entry?:RoutineEntry){if(!requireActive())return;routineNeedsEnd.value=false;routineUsingRules.value=false;Object.assign(routineDraft,entry?{...entry,color:entry.color||'green',weekdays:[...entry.weekdays]}:{color:'green',id:'',title:'',weekdays:[1,2,3,4,5],start_time:'09:00',end_time:'10:00'});dialog.value='routine'}
async function generateRoutineFromText(){
 routineUsingRules.value=false
 const suggestion=await planner.suggestRoutine(routinePrompt.value)
 routineUsingRules.value=suggestion?.source==='rules'
 if(suggestion?.action==='remove'){
  routineRemovals.value=routineRemovalMatches(routines.value,suggestion)
  if(!routineRemovals.value.length){error.value='요청한 이름과 요일에 맞는 시간표가 없어요. 활동 이름을 확인해 주세요.';return}
  dialog.value='routine-remove'
 }else if(suggestion){routineNeedsEnd.value=!suggestion.end_time;Object.assign(routineDraft,{id:'',color:'green',...suggestion});dialog.value='routine'}
}
async function applyRoutineRemoval(row:RoutineRemoval){
 const current=routines.value.find(entry=>entry.id===row.entry.id)
 if(!current||JSON.stringify(current)!==JSON.stringify(row.entry)){error.value='시간표가 변경되었습니다. 요청을 다시 입력해 주세요.';return}
 const ok=row.remainingWeekdays.length?await planner.run(()=>planner.save('routines',{...current,weekdays:[...row.remainingWeekdays]})):await planner.removeRoutine(current.id)
 if(ok){routineRemovals.value=routineRemovals.value.filter(value=>value.entry.id!==current.id);notice.value='선택한 요일의 시간표를 제거했습니다.';if(!routineRemovals.value.length)dialog.value=''}
}
async function submitRoutine(){if(!requireActive())return;const old=routines.value.find(entry=>entry.id===routineDraft.id);const value={...(old||planner.stamp()),title:routineDraft.title.trim(),color:routineDraft.color,weekdays:[...routineDraft.weekdays],start_time:routineDraft.start_time,end_time:routineDraft.end_time};if(await planner.run(()=>planner.save('routines',value)))dialog.value=''}
async function deleteRoutine(){if(await planner.removeRoutine(routineDraft.id))dialog.value=''}
async function toggleRoutine(enabled:boolean){if(!requireActive())return;await planner.saveSettings(settings.value.timezone,settings.value.display_name,enabled)}
async function submitSettings(){if(await planner.saveSettings(timezone.value,displayName.value))dialog.value=''}
function openSettings(){if(!requireActive())return;timezone.value=settings.value.timezone;displayName.value=settings.value.display_name;dialog.value='settings'}
async function submitAuth(){const ok=await planner.auth(authMode.value,authForm.email,authForm.password);authForm.password='';if(ok && ['login','update'].includes(authMode.value))dialog.value=''}
function escape(event:KeyboardEvent){
 if (!dialog.value) return
 if(event.key==='Escape'&&!busy.value) { dialog.value=''; return }
 if(event.key!=='Tab') return
 const elements=dialogElement.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]')
 if(!elements?.length)return
 const first=elements[0]!,last=elements[elements.length-1]!
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
watch(dialog,async(value,old)=>{
 if(!old&&value)previousFocus=document.activeElement as HTMLElement
 document.body.style.overflow=value?'hidden':''
 if(!value){authForm.password='';await nextTick();previousFocus?.focus();return}
 await nextTick();dialogElement.value?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
})
watch(recovery,value=>{if(value){authMode.value='update';dialog.value='auth'}})
watch(active,(value,old)=>{if(old&&!value)dialog.value=''})
watch(selected,value=>{if(view.value==='calendar'&&value)history.replaceState(null,'','?view=calendar&date='+value)})
watch(today,(value,old)=>{if(selected.value===old){selected.value=value;}})
let dispose: (()=>void)|undefined
function readRoute(){
 const params=new URLSearchParams(location.search),route=params.get('view')
 selectedProject.value=params.get('project')||''
 view.value=route&&['home','today','projects','project','calendar'].includes(route)?route:'home'
 if(route==='projects'&&selectedProject.value)view.value='project'
 projectTab.value=params.get('tab')==='materials'?'materials':'work'
 const date=params.get('date');if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date)))selected.value=date
 if(route==='briefing')dialog.value='briefing'
}
watch(projectTab,()=>{if(view.value==='project')history.replaceState(null,'','?view=project&project='+selectedProject.value+'&tab='+projectTab.value)})
onMounted(async()=>{readRoute();if(new URLSearchParams(location.search).get('recovery')==='1'){authMode.value='update';dialog.value='auth'}document.addEventListener('keydown',escape);window.addEventListener('popstate',readRoute);dispose=await planner.init()})
onUnmounted(()=>{dispose?.();document.removeEventListener('keydown',escape);window.removeEventListener('popstate',readRoute);document.body.style.overflow=''})

</script>

<template>
  <div class="planner" :class="`variant-${variant}`">
    <aside class="sidebar" :inert="Boolean(dialog)" :class="{open:mobileNav}">
      <button class="icon-button mobile-only close-nav" aria-label="메뉴 닫기" @click="mobileNav=false"><X :size="20" /></button><BrandLogo @home="go('home')" />
      <div class="workspace-label">MY CAREER WORKSPACE</div>
      <nav aria-label="주 메뉴"><button v-for="entry in nav" :key="entry.id" :class="{active:view===entry.id||(entry.id==='projects'&&view==='project')}" :aria-current="view===entry.id||(entry.id==='projects'&&view==='project') ? 'page' : undefined" @click="go(entry.id)"><component :is="entry.icon" :size="19" />{{ entry.label }}<span v-if="entry.id==='today' && allToday.length" class="nav-count">{{ allToday.length-doneToday }}</span></button></nav>
      <div v-if="featureStage >= 3" class="sidebar-projects"><div class="side-heading">내 프로젝트<button class="icon-button" aria-label="프로젝트 추가" @click="editProject()"><Plus :size="16" /></button></div><button v-for="(project,index) in activeProjects.slice(0,4)" :key="project.id" class="side-project" @click="openProjectPage(project.id)"><span class="project-square" :class="`square-${index%3}`"></span>{{ project.title }}</button><p v-if="!projects.length" class="quiet">첫 지원 프로젝트를 만들어 보세요.</p></div>
      <div class="sidebar-bottom"><button class="settings-nav" @click="dialog='trash'"><Trash2 :size="18" />휴지통 <span v-if="trash.length">{{ trash.length }}</span></button><button v-if="featureStage >= 4" class="settings-nav" @click="openSettings"><Settings2 :size="17" />워크스페이스 설정</button></div>
    </aside>
    <button v-if="mobileNav" class="nav-scrim" aria-label="메뉴 닫기" @click="mobileNav=false"></button><div class="main-shell" :inert="Boolean(dialog)">
      <header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-only" aria-label="메뉴 열기" @click="mobileNav=!mobileNav"><Menu :size="21" /></button><button class="breadcrumb-home" @click="go('home')">홈</button><template v-if="view!=='home'"><span class="slash">/</span><strong>{{ sectionLabel }}</strong></template></div><div class="header-actions"><button class="icon-button notification-button" :aria-label="notificationTitle" @click="dialog='briefing'"><Bell :size="19" /><span v-if="notificationCount" class="notification-count">{{ notificationCount }}</span></button><span class="today-header">{{ formatDate(today) }}</span><button v-if="active" class="icon-button" :disabled="busy" aria-label="데이터 새로고침" @click="planner.load"><RefreshCw :size="17" /></button><button v-if="!active" class="login-button" @click="authMode='login';dialog='auth'">로그인</button><button v-else class="avatar" aria-label="계정 설정" @click="openSettings">{{ (settings.display_name || user?.email || '나').slice(0,1).toUpperCase() }}</button></div></header>
      <main>
        <div v-if="bannerError" role="alert" class="message error"><span>{{ bannerError }}</span><button @click="planner.load">다시 불러오기</button><button aria-label="오류 알림 닫기" @click="error=''"><X :size="16" /></button></div>
        <div v-if="notice" role="status" class="message success">{{ notice }}<button aria-label="알림 닫기" @click="notice=''"><X :size="16" /></button></div>
        <div v-if="demo&&view==='home'" class="demo-banner"><span><Sparkles :size="14" /> 체험 모드 · 이 브라우저에만 저장됩니다</span><button v-if="featureStage >= 4" @click="authMode='login';dialog='auth'">로그인</button><button :disabled="busy" @click="planner.logout">체험 종료</button></div>
        <div v-if="!active" class="welcome-bar"><span><strong>나의 다음을 준비하는 공간</strong> 일정과 지원 자료를 한곳에서 관리하세요.</span><div><button class="text-button" @click="startDemo">체험 시작</button><button class="small-primary" @click="authMode='signup';dialog='auth'">무료로 시작하기</button></div></div>
        <section v-if="view!=='project'" class="page-heading"><div><div class="eyebrow">{{ view==='home' ? 'YOUR NEXT CHAPTER' : view==='today' ? 'MAKE TODAY COUNT' : view==='calendar' ? 'PLAN YOUR NEXT STEP' : view==='projects' ? 'BUILD YOUR NEXT CHAPTER' : 'A LITTLE HEAD START' }}</div><h1>{{ view==='home' ? homeTitle : view==='today' ? '오늘 할 일' : view==='calendar' ? '빈틈없이, 여유 있게' : view==='projects' ? '나의 다음을 향한 프로젝트' : '내일의 나를 위한 브리핑' }}<span v-if="view==='today'" class="heading-sun">☀</span></h1><p>{{ (view==='home'||view==='today') ? '학업도, 취업 준비도. 오늘은 하나씩 완성해 볼까요?' : view==='calendar' ? '학업과 커리어 준비의 균형을 달력에서 찾아보세요.' : view==='projects' ? '흩어진 준비 자료와 할 일을 하나의 흐름으로 모아보세요.' : '다가오는 일정과 중요한 할 일을 미리 살펴보세요.' }}</p></div><button v-if="view!=='calendar'" class="primary-button" :disabled="loading || busy" @click="view==='projects' ? editProject() : editTask()"><Plus :size="18" />{{ view==='projects' ? '프로젝트 만들기' : '할 일 추가' }}</button></section>
        <div v-if="loading" class="loading" role="status">워크스페이스를 불러오는 중입니다…</div>
        <template v-else>
        <div v-if="view==='home'" class="overview-grid"><section class="day-hero"><div class="hero-copy"><span class="hero-label"><Sun :size="16" /> {{ formatDate(today) }}</span><h2>{{ homeSummary.title }}</h2><p :title="homeSummary.detail">{{ homeSummary.detail }}</p><div class="hero-progress"><span><b>{{ doneToday }}</b> / {{ allToday.length }} 완료</span><span>{{ progress }}%</span></div><div class="progress-track" role="progressbar" aria-label="오늘 할 일 완료율" :aria-valuenow="progress" :aria-valuemin="0" :aria-valuemax="100"><span :style="{width:progress+'%'}"></span></div></div><div class="hero-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-card"><Check :size="38" :stroke-width="3" /></div><span class="art-star">✳</span><span class="art-small">✦</span></div></section><button type="button" class="stat-card" aria-label="오늘 할 일로 이동" @click="go('today')"><div class="stat-icon"><ListTodo :size="21" /></div><span>오늘 남은 할 일</span><strong>{{ allToday.length-doneToday }}<small>개</small></strong><p>차근차근, 나의 속도로</p></button><button v-if="featureStage >= 3" type="button" class="stat-card" aria-label="취업 관리로 이동" @click="go('projects')"><div class="stat-icon purple"><FolderOpen :size="21" /></div><span>내 지원 프로젝트</span><strong>{{ activeProjects.length }}<small>개</small></strong><span class="stat-link">준비 상황 살펴보기 <ArrowUpRight :size="14" /></span></button></div>
        <RoutineSchedule v-if="view==='home'" :entries="routines" :enabled="Boolean(settings.show_routine)" :today="today" :busy="busy" @toggle="toggleRoutine" @edit="editRoutine" @ai="error='';dialog='routine-ai'" />
        <template v-if="view==='home' || view==='today' || view==='calendar'">
<div class="content-grid" :class="{'with-calendar':view==='calendar','kanban-content':view==='today','calendar-only':view==='calendar'&&calendarExpanded}">
            <CalendarPanel v-if="view==='calendar'" v-model="selected" v-model:mode="calendarMode" :tasks="tasks" :today="today" :busy="busy" expandable :expanded="calendarExpanded" @expand="calendarExpanded=!calendarExpanded" @move="editCalendarTask" />
            <section v-show="view!=='calendar'||!calendarExpanded" :id="view==='calendar'?'calendar-day-tasks':undefined" class="task-section">
<div class="section-heading"><h2>{{ view==='calendar' ? formatDate(selected) : '오늘의 할 일' }} <span class="count-pill">{{ dayTasks.length }}</span></h2><span v-if="view!=='home'" class="muted label-small">우선순위 순</span></div><div v-if="view!=='home'" class="list-toolbar"><div class="tabs"><button v-for="cat in ['전체',...categoryOptions]" :key="cat" :class="{active:filter===cat}" @click="filter=cat">{{ cat }}</button></div><label class="search-box"><Search :size="16" /><input v-model="search" aria-label="할 일 검색" placeholder="할 일 검색"></label></div>
              <TaskBoard v-if="view==='today'&&visibleTasks.length" :tasks="visibleTasks" :contexts="taskContexts" :disabled="busy" @edit="editTask" @toggle="toggle" @postpone="askPostpone" @project="openProject" @status="moveStatus" @remove="planner.trashTask" /><div v-else-if="view!=='today'" class="task-list"><TaskCard v-for="task in (view==='home'?homeTasks:pending)" :key="task.id" :task="task" :context="context(task)" :show-scheduling="true" :disabled="busy" @toggle="toggle(task)" @remove="planner.trashTask(task)" @edit="editTask(task)" @postpone="askPostpone(task)" @project="openProject(task)" /></div>
              <div v-if="!visibleTasks.length" class="empty-state"><div class="empty-icon"><Sun v-if="view==='home'" :size="30" /><CalendarDays v-else :size="30" /></div><h3>{{ dayTasks.length ? '검색 결과가 없어요' : '아직 비어 있는 하루예요' }}</h3><p>{{ dayTasks.length ? '다른 검색어나 분류를 선택해 보세요.' : '작은 할 일 하나로 나의 다음을 시작해 보세요.' }}</p><button v-if="!dayTasks.length" class="outline-button" @click="editTask()"><Plus :size="16" /> 첫 할 일 추가</button></div>
              <template v-if="view==='calendar'&&completed.length"><div class="completed-heading"><Check :size="16" />완료한 일 <span>{{ completed.length }}</span></div><TaskCard v-for="task in completed" :key="task.id" :task="task" :context="context(task)" :show-scheduling="true" :disabled="busy" @toggle="toggle(task)" @remove="planner.trashTask(task)" @edit="editTask(task)" @project="openProject(task)" /></template><button class="add-task-row" @click="editTask()"><Plus :size="17" /> 새로운 할 일 추가하기</button>
            </section>
            <aside v-if="view==='home'" class="right-rail"><section v-if="featureStage >= 3" class="panel project-preview"><div class="section-heading"><h3>오늘의 프로젝트</h3><button class="icon-button" aria-label="프로젝트 전체 보기" @click="go('projects')"><ArrowUpRight :size="17" /></button></div><button v-for="(project,i) in todayProjects" :key="project.id" class="preview-project" @click="openProjectPage(project.id)"><span class="company-logo" :class="`square-${i%3}`">{{ (project.company||project.title).slice(0,1) }}</span><span><strong>{{ project.title }}</strong><small>{{ project.deadline ? '마감 '+project.deadline.slice(5).replace('-','.') : '마감일 미정' }}</small></span></button><p v-if="!todayProjects.length" class="quiet">오늘 할 일에 연결된 프로젝트가 없어요.</p></section></aside>
          </div>
        </template>
        <ProjectCollections v-else-if="view==='projects'" :projects="projects" :items="items" :materials="materials" :busy="busy" @open="openProjectPage" @move="planner.moveProject" />
        <section v-else-if="view==='project'&&chosenProject" class="project-page"><button class="project-back" @click="go('projects')"><ChevronLeft :size="16" />지원 프로젝트 목록</button><div class="project-top"><div><span class="eyebrow">{{ chosenProject.company||'MY NEXT CHAPTER' }}</span><h1>{{ chosenProject.title }} <span v-if="chosenProject.archived_at" class="ended-badge">종료된 프로젝트</span></h1><p v-if="chosenProject.start_date||chosenProject.deadline"><CalendarDays :size="15" />지원 기간 {{ chosenProject.start_date||'시작일 미정' }} ~ {{ chosenProject.deadline||'마감일 미정' }}</p></div><div class="project-detail-actions"><button class="outline-button" @click="editProject(chosenProject)">프로젝트 수정</button><button v-if="!chosenProject.archived_at" class="text-button" @click="dialog='archive-project'">프로젝트 종료</button><button v-else class="outline-button" :disabled="busy" @click="planner.setProjectArchived(chosenProject,false)">진행 재개</button></div></div><div class="project-tabs" role="group" aria-label="프로젝트 상세 보기"><button :aria-pressed="projectTab==='work'" @click="projectTab='work'"><CalendarDays :size="17" />일정·할 일</button><button :aria-pressed="projectTab==='materials'" @click="projectTab='materials'"><FileText :size="17" />자료 보관함 <span>{{ materials.filter(material=>material.project_id===chosenProject!.id).length }}</span></button></div><template v-if="projectTab==='work'"><div class="board"><section v-for="(stage,index) in stageList" :key="stage" class="board-column"><div class="board-heading"><h3><span class="stage-mark" :class="`stage-${index}`"></span>{{ stage }}</h3><span>{{ items.filter(i=>i.project_id===chosenProject!.id&&i.stage===stage).length }}</span></div><ProjectWorkCard v-for="item in items.filter(i=>i.project_id===chosenProject!.id&&i.stage===stage)" :key="item.id" :item="item" :work="itemWork(item)" :subtasks="ordered.filter(task=>task.project_item_id===item.id)" :disabled="busy" :title="itemTitle(item)" @edit="editItem(stage,item)" @toggle="toggle" @task="$event ? editTask($event) : addLinkedTask(item)" @restore="planner.restoreTask" /><button class="board-add" @click="editItem(stage)"><Plus :size="16" />일정 추가</button></section></div></template><ProjectArchive v-else :materials="materials.filter(material=>material.project_id===chosenProject!.id)" :busy="busy" @add="openMaterial()" @edit="openMaterial" @download="planner.downloadMaterial" /></section>
        <div v-else-if="view==='project'" class="empty-state"><h2>프로젝트를 찾지 못했습니다.</h2><button class="outline-button" @click="go('projects')">프로젝트 목록으로</button></div>
        <CalendarPanel v-if="view==='home'" v-model="overviewDate" v-model:mode="calendarMode" :tasks="tasks" :today="today" :weekly-priorities="settings.weekly_priorities" :busy="busy" overview :save-priorities="planner.saveWeekly" @move="editCalendarTask" @open="selected=$event;go('calendar')" />
        <section v-if="featureStage >= 3 && active && !tasks.length && !projects.length" class="sample-prompt"><Sparkles :size="19" /><div><strong>어디서부터 시작할지 고민되나요?</strong><p>예시 프로젝트와 할 일을 추가해 사용 흐름을 살펴보세요.</p></div><button class="outline-button" :disabled="busy" @click="planner.addExamples">예시 데이터 추가</button></section>
        </template>
        <footer><span><strong class="footer-brand">CareerTrack</strong> 오늘의 작은 계획, 내일의 가능성.</span><button @click="dialog='help'"><CircleHelp :size="14" />사용 안내</button></footer>
      </main>
    </div>
    <div v-if="dialog" class="modal-backdrop" @click.self="!busy&&(dialog='')">
<section ref="dialogElement" class="modal" :class="{'wide-modal':dialog==='item'||dialog==='material'}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">
<button class="modal-close icon-button" aria-label="닫기" :disabled="busy" @click="dialog=''"><X :size="21" /></button>
      <template v-if="dialog==='archive-project'&&chosenProject"><h2 id="dialog-title">프로젝트를 종료할까요?</h2><p class="modal-intro">{{ chosenProject.title }}을 종료된 프로젝트로 옮깁니다. 일정·메모·첨부 자료는 그대로 보관되며 언제든 진행을 재개할 수 있습니다.</p><p v-if="tasks.some(task=>!task.completed&&items.some(item=>item.id===task.project_item_id&&item.project_id===chosenProject!.id))" class="config-note">아직 끝내지 않은 할 일은 기존 일정에 남습니다. 자동으로 완료 처리하지 않습니다.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy" @click="planner.setProjectArchived(chosenProject,true).then(ok=>{if(ok)dialog=''})">종료하고 보관</button></template>
      <form v-else-if="dialog==='material'" @submit.prevent="submitMaterial"><h2 id="dialog-title">프로젝트 자료 보관</h2><p class="modal-intro">{{ chosenProject?.title }}에 필요한 자료를 저장하세요.</p><div class="form-row schedule-name-row"><label>자료 이름<input v-model="materialDraft.title" required maxlength="200" placeholder="예: 자기소개서 최종본"></label><label>자료 종류<select v-model="materialDraft.kind"><option v-for="kind in MATERIAL_KINDS" :key="kind">{{ kind }}</option></select></label></div><label>파일 첨부 <span class="optional">선택 · 최대 10MB</span><input type="file" accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" @change="selectMaterialFile"></label><p v-if="materialFile" class="material-file-note">{{ materialFile.name }}</p><p v-else-if="materials.find(material=>material.id===materialDraft.id)?.file_name" class="material-file-note">현재 파일: {{ materials.find(material=>material.id===materialDraft.id)?.file_name }}</p><label>참고 링크 <span class="optional">선택</span><input v-model="materialDraft.url" type="url" maxlength="2048" placeholder="https://"></label><label>본문·메모 <span class="optional">선택</span><textarea v-model="materialDraft.content" rows="4" maxlength="50000" placeholder="자소서 초안, 채용 공고, 기업 분석 등을 보관하세요."></textarea></label><p v-if="demo" class="routine-form-note">체험 모드의 파일은 현재 브라우저에만 보관됩니다.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">{{ busy?'저장 중…':'자료 보관하기' }}</button></form>
      <template v-else-if="dialog==='delete-task'&&permanentTarget"><h2 id="dialog-title">영구 삭제할까요?</h2><p class="modal-intro"><strong>{{ permanentTarget.title }}</strong><br>휴지통에서도 제거되며 복구할 수 없습니다. 연결된 프로젝트와 보관 자료는 유지됩니다.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="danger-button full" :disabled="busy" @click="confirmPermanentDelete">{{ busy?'삭제 중…':'영구 삭제' }}</button><button class="demo-button" :disabled="busy" @click="dialog='trash';permanentTarget=null">취소</button></template>
      <template v-else-if="dialog==='trash'"><div class="modal-symbol"><Trash2 :size="25" /></div><h2 id="dialog-title">휴지통</h2><p class="modal-intro">복원하거나 영구 삭제할 수 있습니다. 영구 삭제한 할 일은 복구할 수 없습니다.</p><p v-if="!trash.length" class="notification-empty">휴지통이 비어 있어요.</p><div v-for="task in trash" :key="task.id" class="trash-row"><div><strong>{{ task.title }}</strong><span>실행 예정일 {{ task.scheduled_date }}</span></div><div class="trash-row-actions"><button class="outline-button" :disabled="busy" @click="planner.restoreTask(task)">복원</button><button class="text-button trash-delete" :disabled="busy" @click="permanentTarget=task;error='';dialog='delete-task'">영구 삭제</button></div></div><p v-if="error" class="form-error" role="alert">{{ error }}</p></template>
      <template v-else-if="dialog==='routine-remove'"><p v-if="routineUsingRules" class="config-note" role="status">AI 연결이 원활하지 않아 기본 규칙으로 정리했어요. 제거할 요일을 확인해 주세요.</p><h2 id="dialog-title">시간표를 제거할까요?</h2><p class="modal-intro">제거할 요일과 시간을 확인하세요. 나머지 요일은 유지되며, 모두 제거하면 이 루틴은 삭제됩니다.</p><div v-for="row in routineRemovals" :key="row.entry.id" class="trash-row"><div><strong>{{ row.entry.title }}</strong><span>{{ row.entry.weekdays.filter(day=>!row.remainingWeekdays.includes(day)).map(day=>weekdayLabels[day]).join('·') }}요일 · {{ row.entry.start_time }}~{{ row.entry.end_time }}</span></div><button class="danger-button" :disabled="busy" @click="applyRoutineRemoval(row)">제거하기</button></div><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="demo-button" :disabled="busy" @click="dialog='routine-ai'">돌아가기</button></template>
      <form v-else-if="dialog==='routine-ai'" @submit.prevent="generateRoutineFromText"><h2 id="dialog-title">AI로 시간표 편집</h2><p class="modal-intro">추가하거나 제거할 요일과 활동을 적어 주세요.</p><label>반복할 일정<textarea v-model="routinePrompt" rows="3" required maxlength="500" :disabled="busy" placeholder="예: 월화수 9:00~10:00에 기출 풀기"></textarea></label><p class="routine-form-note">입력한 문장은 OpenRouter와 AI 제공사에 전달됩니다. 개인정보는 넣지 마세요. 결과를 확인한 뒤 저장할 수 있어요.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="busy" role="status" class="routine-form-note">시간표를 정리하고 있어요…</p><button class="primary-button full" :disabled="busy||!routinePrompt.trim()">{{ busy?'정리 중…':'요청 해석하기' }}</button></form>
      <form v-else-if="dialog==='routine'" @submit.prevent="submitRoutine"><h2 id="dialog-title">{{ routineDraft.id?'루틴 수정':'고정 시간표 추가' }}</h2><p class="modal-intro">매주 같은 요일과 시간에 반복할 활동을 등록하세요.</p><p v-if="routineUsingRules" class="config-note" role="status">AI 연결이 원활하지 않아 기본 규칙으로 정리했어요. 요일과 시간을 확인한 뒤 저장해 주세요.</p><label>활동 이름<input v-model="routineDraft.title" required maxlength="120" placeholder="예: 아침 영어 공부"></label><fieldset class="routine-color-options"><legend>시간표 색상</legend><label v-for="color in ROUTINE_COLORS" :key="color.value" :title="color.label"><input v-model="routineDraft.color" type="radio" name="routine-color" :value="color.value" :aria-label="color.label"><span :style="{background:color.background,borderColor:color.borderColor,color:color.color}"><Check v-if="routineDraft.color===color.value" :size="20" /></span></label></fieldset><fieldset class="routine-day-options"><legend>반복 요일</legend><label v-for="weekday in [{id:1,label:'월'},{id:2,label:'화'},{id:3,label:'수'},{id:4,label:'목'},{id:5,label:'금'},{id:6,label:'토'},{id:0,label:'일'}]" :key="weekday.id"><input v-model="routineDraft.weekdays" type="checkbox" :value="weekday.id">{{ weekday.label }}</label></fieldset><div class="form-row"><label>시작 시간<input v-model="routineDraft.start_time" type="text" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" maxlength="5" placeholder="09:00" title="00:00~23:59 범위에서 HH:mm 형식으로 입력하세요." required></label><label>종료 시간<input v-model="routineDraft.end_time" type="text" pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00" maxlength="5" placeholder="21:00" title="HH:mm 형식으로 입력하세요. 하루의 끝은 24:00입니다." required></label></div><p v-if="routineNeedsEnd&&!routineDraft.end_time" class="config-note" role="status">요일과 시작 시간을 정리했어요. 종료 시간을 입력한 뒤 저장해 주세요.</p><p class="routine-form-note">24시간제로 입력하세요. 예: 21:00~23:00. 하루 끝까지라면 종료 시간을 24:00으로 입력하세요.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">시간표 저장</button><button v-if="routineDraft.id" class="demo-button" type="button" @click="dialog='delete-routine'">이 루틴 삭제</button></form>
      <template v-else-if="dialog==='delete-routine'"><h2 id="dialog-title">이 루틴을 삭제할까요?</h2><p class="modal-intro">{{ routineDraft.title }}<br>고정 시간표에서 제거됩니다. 날짜별 할 일은 유지됩니다.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="danger-button full" :disabled="busy" @click="deleteRoutine">루틴 삭제</button></template>
      <template v-else-if="dialog==='briefing'"><div class="modal-symbol"><Bell :size="25" /></div><h2 id="dialog-title">{{ notificationTitle }}</h2><div v-if="notification.kind==='none'" class="notification-empty">알림이 없습니다.</div><template v-else><p class="modal-intro">{{ formatDate(notification.date) }}<br>{{ notification.kind==='today'?'30분 안에 시작하는 시간표를 확인하세요.':'내일의 시간표와 남은 할 일을 확인하세요.' }}</p><div v-for="entry in notification.routines" :key="entry.id" class="notification-task"><span class="category">고정 시간표</span><button @click="editRoutine(entry)">{{ entry.title }}</button><span class="muted">{{ entry.start_time }}~{{ entry.end_time }}</span></div><div v-for="task in notification.tasks" :key="task.id" class="notification-task"><span class="category" :style="categoryStyle(task.category)">{{ task.category }}</span><button @click="editTask(task)">{{ task.title }}</button></div><div v-if="!notificationCount" class="notification-empty">내일 예정된 일정이 없어요.</div><button class="primary-button full" @click="selected=notification.date;dialog='';go('calendar')">{{ notification.kind==='today'?'오늘 일정 보기':'내일 일정 보기' }}</button></template></template>
      <template v-else-if="dialog==='auth'"><div class="modal-symbol"><Leaf :size="26" /></div><h2 id="dialog-title">{{ authMode==='login' ? '다시 만나 반가워요' : authMode==='signup' ? '나의 다음을 시작해 보세요' : authMode==='update' ? '새 비밀번호 설정' : '비밀번호를 잊으셨나요?' }}</h2><p class="modal-intro">학업과 커리어 준비를 한곳에서, CareerTrack.</p><p v-if="!configured" class="config-note">Supabase 연결 설정이 필요합니다. 지금은 체험 모드에서 기능을 확인할 수 있어요.</p><form @submit.prevent="submitAuth"><label v-if="authMode!=='update'">이메일<input v-model="authForm.email" type="email" autocomplete="email" required placeholder="hello@example.com"></label><label v-if="authMode!=='reset'">비밀번호<input v-model="authForm.password" type="password" :autocomplete="authMode==='login' ? 'current-password':'new-password'" minlength="8" required placeholder="8자 이상 입력하세요"></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="notice" class="form-success" role="status">{{ notice }}</p><button class="primary-button full" :disabled="busy||!configured">{{ busy ? '처리 중…' : authMode==='login' ? '로그인' : authMode==='signup' ? '계정 만들기' : authMode==='update' ? '새 비밀번호 저장' : '재설정 메일 보내기' }}</button></form><div class="auth-links"><button @click="authMode=authMode==='signup'?'login':'signup'">{{ authMode==='signup' ? '이미 계정이 있나요? 로그인' : '처음이신가요? 회원가입' }}</button><button @click="authMode='reset'">비밀번호 찾기</button></div><button class="demo-button" @click="startDemo">계정 없이 체험하기</button></template>
      <form v-else-if="dialog==='task'" @submit.prevent="submitTask"><h2 id="dialog-title">{{ editingTask ? '할 일 수정' : '새로운 할 일' }}</h2><p class="modal-intro">작게 나누고, 가볍게 시작해 보세요.</p><label>할 일 이름<input v-model="draftTask.title" required maxlength="200" autofocus placeholder="예: 자기소개서 1번 문항 초안 쓰기"></label><div class="form-row"><label>실행 예정일<input v-model="draftTask.scheduled_date" type="date" required></label><label>제출 마감일 <span class="optional">선택</span><input v-model="draftTask.deadline" type="date" :min="draftTask.scheduled_date"></label></div><div class="form-row"><label>분류<select v-model="draftTask.category"><option v-for="category in categoryOptions" :key="category" :value="category">{{ category }}</option><option value="__custom">직접 입력</option></select></label><label>우선순위<select v-model="draftTask.priority"><option :value="1">높음</option><option :value="2">보통</option><option :value="3">낮음</option></select></label></div><label v-if="draftTask.category==='__custom'">분류 직접 입력<input v-model="customCategory" required maxlength="40" placeholder="예: 자격증, 동아리, 어학 공부"></label><label v-if="editingTask">진행 상태<select v-model="draftTask.status"><option value="todo">할 일</option><option value="in_progress">진행 중</option><option value="done">완료</option></select></label><label>프로젝트 연결 <span class="optional">선택</span><select v-model="taskProjectId" @change="draftTask.project_item_id=''"><option value="">개인 일정 · 연결하지 않음</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option></select></label><template v-if="taskProjectId"><label>프로젝트 항목<select v-model="draftTask.project_item_id"><option value="">새 카드로 함께 등록</option><option v-for="item in items.filter(item=>item.project_id===taskProjectId)" :key="item.id" :value="item.id">{{ item.stage }} · {{ itemTitle(item) }}</option></select></label><label v-if="!draftTask.project_item_id">등록 단계<select v-model="taskStage"><option v-for="stage in stageList" :key="stage">{{ stage }}</option></select></label></template><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">{{ busy ? '저장 중…' : '할 일 저장' }}</button></form>
      <form v-else-if="dialog==='project'" @submit.prevent="submitProject"><h2 id="dialog-title">{{ draftProject.id ? '프로젝트 수정' : '새 지원 프로젝트' }}</h2><p class="modal-intro">하나의 목표에 필요한 준비를 모아보세요.</p><label>프로젝트 이름<input v-model="draftProject.title" required maxlength="200" placeholder="예: 올리브영 신입 공채"></label><label>기업명 <span class="optional">선택</span><input v-model="draftProject.company" maxlength="200" placeholder="예: CJ 올리브영"></label><div class="form-row"><label>지원 시작일 <span class="optional">선택</span><input v-model="draftProject.start_date" type="date"></label><label>지원 마감일 <span class="optional">선택</span><input v-model="draftProject.deadline" type="date" :min="draftProject.start_date||undefined"></label></div><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">{{ busy ? '저장 중…' : '프로젝트 저장' }}</button></form>
      <form v-else-if="dialog==='item'" @submit.prevent="submitItem"><h2 id="dialog-title">프로젝트 일정</h2><p class="modal-intro">언제 할 일인지 정하고, 필요한 메모만 짧게 남기세요.</p><div class="form-row schedule-name-row"><label>할 일 이름<input v-model="draftItem.title" required maxlength="200"></label><label>준비 단계<select v-model="draftItem.stage"><option v-for="stage in stageList" :key="stage">{{ stage }}</option></select></label></div><div class="form-row"><label>실행 예정일<input v-model="draftItem.scheduled_date" type="date" required></label><label>마감일 <span class="optional">선택</span><input v-model="draftItem.deadline" type="date" :min="draftItem.scheduled_date"></label></div><p class="routine-form-note">오늘 할 일과 달력에도 같은 일정으로 반영됩니다.</p><label>메모 <span class="optional">선택</span><textarea v-model="draftItem.content" rows="3" maxlength="1000" placeholder="예: 1번 문항은 팀 프로젝트 경험으로 작성하기"></textarea></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">일정 저장</button></form>
      <form v-else-if="dialog==='postpone'" @submit.prevent="submitPostpone"><h2 id="dialog-title">다른 날에 이어서 할까요?</h2><p class="modal-intro">{{ postponed?.title }}<br>제출 마감일과 프로젝트 연결은 유지됩니다.</p><label>새 실행 예정일<input v-model="nextDate" type="date" required></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">날짜 변경</button></form>

      <form v-else-if="dialog==='settings'" @submit.prevent="submitSettings"><h2 id="dialog-title">워크스페이스 설정</h2><p class="modal-intro">{{ demo ? '브라우저 체험 모드' : user?.email }}</p><label>이름<input v-model="displayName" maxlength="80" placeholder="나를 부를 이름"></label><label>시간대<select v-model="timezone"><option value="Asia/Seoul">서울 (Asia/Seoul)</option><option value="Asia/Tokyo">도쿄 (Asia/Tokyo)</option><option value="America/New_York">뉴욕 (America/New_York)</option><option value="America/Los_Angeles">로스앤젤레스 (America/Los_Angeles)</option><option value="Europe/London">런던 (Europe/London)</option><option value="UTC">UTC</option></select></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="notice" class="form-success" role="status">{{ notice }}</p><button class="primary-button full" :disabled="busy">{{ busy?'저장 중…':'저장하기' }}</button><button class="demo-button" type="button" :disabled="busy" @click="planner.logout().then(ok=>{if(ok)dialog=''})"><LogOut :size="15" />{{ demo ? '체험 종료' : '로그아웃' }}</button></form>
      <template v-else><h2 id="dialog-title">CareerTrack 사용 안내</h2><div class="help-copy"><p>할 일을 실행할 날짜와 제출 마감일을 각각 지정하세요. 날짜별 일정에서 지난 일정도 수정할 수 있습니다.</p><p>지원 프로젝트를 만들고 준비·진행·마감 단계에 자료 항목을 추가하세요. 할 일을 자료에 연결하면 어느 화면에서든 같은 완료 상태가 보입니다.</p><p>다른 날로 미루기는 실행 날짜만 바꾸며, 내일 브리핑은 저장된 최신 일정을 보여줍니다.</p><p>체험 데이터는 이 브라우저에 저장됩니다. 실제 계정으로 로그인하면 세 시안에서 같은 Supabase 데이터를 사용할 수 있습니다.</p></div></template>
    </section>
</div>
  </div>
</template>

<style scoped>
.content-grid.calendar-only{grid-template-columns:minmax(0,1fr)}

.trash-row-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex-shrink:0}.trash-delete{color:#ac4545;font-size:12px}.trash-row>div:first-child{min-width:0}.trash-row strong{overflow-wrap:anywhere}

button.stat-card{text-align:left;width:100%;font:inherit}button.stat-card:focus-visible{outline:3px solid var(--brand);outline-offset:3px}.overview-grid .stat-link{display:flex;align-items:center;gap:4px;margin-top:auto;font-size:11px}

.overview-grid{margin-bottom:26px}.overview-grid .day-hero{min-height:168px;padding:18px 22px}.overview-grid .hero-label{margin-bottom:8px}.overview-grid .hero-copy h2{font-size:20px;line-height:1.4;letter-spacing:-.5px}.overview-grid .hero-copy>p{line-height:1.6;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.overview-grid .hero-progress{margin-top:12px}.overview-grid .hero-art{top:-3px;right:-10px;transform:scale(.72) rotate(-13deg);transform-origin:center}.overview-grid .stat-card{padding:16px 18px;min-height:168px}.overview-grid .stat-icon{width:30px;height:30px;margin-bottom:8px}.overview-grid .stat-card>strong{font-size:30px;margin:3px 0 5px}

.routine-color-options{border:0;padding:0;margin:20px 0 0;display:flex;gap:12px;flex-wrap:wrap}.routine-color-options legend{font-size:13px;font-weight:700;color:#5f705b;margin-bottom:12px}.routine-color-options label{position:relative;margin:0;cursor:pointer}.routine-color-options input{position:absolute;opacity:0;width:1px;height:1px;margin:0}.routine-color-options label>span{display:grid;place-items:center;width:40px;height:40px;border:2px solid;border-radius:50%}.routine-color-options input:checked+span{outline:2px solid currentColor;outline-offset:3px}.routine-color-options input:focus-visible+span{outline:3px solid var(--brand);outline-offset:4px}
</style>
