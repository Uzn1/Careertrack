<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useHead, useRuntimeConfig } from '#imports'
import { ArrowUpRight, Bell, Trash2, House, FileText, ChevronLeft, Plus, Sun, CalendarDays, FolderOpen, Sparkles, Search, Settings2, Check, X, LogOut, Menu, ListTodo, RefreshCw, BookOpen, CircleHelp, Leaf } from 'lucide-vue-next'
import { usePlanner } from '../composables/usePlanner'
import { formatDate, shiftDate, postpone, briefingFor, categoryStyle, projectWork, taskStatus, withTaskStatus, type TaskStatus, type CalendarMode, MATERIAL_KINDS, attachmentError, type ProjectMaterial, type RoutineEntry, type Task, type Project, type ProjectItem, type Stage } from '../../shared/domain'
useHead({title:'CareerTrack · 커리어 플래너'})
const planner = usePlanner()
const { materials, routines, trash, recovery, tasks, projects, items, user, demo, busy, loading, error, notice, today, tomorrow, settings, configured, ordered } = planner
const variant = String(useRuntimeConfig().public.variant)
const featureStage = Number(useRuntimeConfig().public.featureStage)
const view = ref('home')
const selected = ref(today.value), search = ref(''), filter = ref('전체'), mobileNav = ref(false)
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
const routineDraft=reactive({id:'',title:'',weekdays:[1,2,3,4,5] as number[],start_time:'09:00',end_time:'10:00'})
const draftProject = reactive({ id:'', title:'', company:'', start_date:'', deadline:'' })
const draftItem = reactive({ id:'', project_id:'', title:'', stage:'준비' as Stage, content:'', deadline:'', scheduled_date:'' })
const postponed = ref<Task | null>(null), nextDate = ref('')
const timezone = ref('Asia/Seoul'), displayName = ref('')
const active = computed(() => demo.value || !!user.value)
const activeProjects=computed(()=>projects.value.filter(project=>!project.archived_at))
const endedProjects=computed(()=>projects.value.filter(project=>Boolean(project.archived_at)).sort((a,b)=>b.archived_at!.localeCompare(a.archived_at!)))
const chosenProject = computed(() => selectedProject.value?projects.value.find(p => p.id === selectedProject.value):projects.value[0])
const day = computed(() => view.value === 'calendar' ? selected.value : today.value)
const briefing = computed(() => briefingFor(tasks.value, tomorrow.value))
const dayTasks = computed(() => ordered.value.filter(t => t.scheduled_date === day.value))
const visibleTasks = computed(() => dayTasks.value.filter(t => (filter.value === '전체' || t.category === filter.value) && (!search.value || t.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))))
const pending = computed(() => visibleTasks.value.filter(task=>!task.completed)), completed = computed(() => visibleTasks.value.filter(t => t.completed))
const taskContexts=computed(()=>Object.fromEntries(tasks.value.map(task=>[task.id,context(task)||''])))
const homeTasks=computed(()=>[...pending.value,...completed.value])
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
async function submitTask(){
 if(!requireActive())return
 const existing=tasks.value.find(task=>task.id===draftTask.id)
 const value:Task=withTaskStatus({...(existing||{...planner.stamp(),id:draftTask.id}),title:draftTask.title.trim(),scheduled_date:draftTask.scheduled_date,deadline:draftTask.deadline||null,priority:Number(draftTask.priority),category:(draftTask.category==='__custom'?customCategory.value:draftTask.category).trim(),project_item_id:taskProjectId.value?(draftTask.project_item_id||draftTask.id):null,completed:existing?.completed||false},draftTask.status)
 if(!value.title)return
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
function editRoutine(entry?:RoutineEntry){if(!requireActive())return;Object.assign(routineDraft,entry?{...entry,weekdays:[...entry.weekdays]}:{id:'',title:'',weekdays:[1,2,3,4,5],start_time:'09:00',end_time:'10:00'});dialog.value='routine'}
async function submitRoutine(){if(!requireActive())return;const old=routines.value.find(entry=>entry.id===routineDraft.id);const value={...(old||planner.stamp()),title:routineDraft.title.trim(),weekdays:[...routineDraft.weekdays],start_time:routineDraft.start_time,end_time:routineDraft.end_time};if(await planner.run(()=>planner.save('routines',value)))dialog.value=''}
async function deleteRoutine(){if(await planner.removeRoutine(routineDraft.id))dialog.value=''}
async function toggleRoutine(enabled:boolean){if(!requireActive())return;await planner.saveSettings(settings.value.timezone,settings.value.display_name,enabled)}
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
      <div class="sidebar-bottom"><div class="growth-note"><span class="growth-sprout"><Leaf :size="28" /></span><strong>조금씩, 꾸준히 자라는 나</strong><p>오늘의 작은 계획이<br>내일의 커리어가 됩니다.</p></div><button class="settings-nav" @click="dialog='trash'"><Trash2 :size="18" />휴지통 <span v-if="trash.length">{{ trash.length }}</span></button><button v-if="featureStage >= 4" class="settings-nav" @click="openSettings"><Settings2 :size="17" />워크스페이스 설정</button></div>
    </aside>
    <button v-if="mobileNav" class="nav-scrim" aria-label="메뉴 닫기" @click="mobileNav=false"></button><div class="main-shell" :inert="Boolean(dialog)">
      <header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-only" aria-label="메뉴 열기" @click="mobileNav=!mobileNav"><Menu :size="21" /></button><button class="breadcrumb-home" @click="go('home')">홈</button><template v-if="view!=='home'"><span class="slash">/</span><strong>{{ sectionLabel }}</strong></template></div><div class="header-actions"><button class="icon-button notification-button" aria-label="내일 일정 알림" @click="dialog='briefing'"><Bell :size="19" /><span v-if="briefing.remaining.length" class="notification-count">{{ briefing.remaining.length }}</span></button><span class="today-header">{{ formatDate(today) }}</span><button v-if="active" class="icon-button" :disabled="busy" aria-label="데이터 새로고침" @click="planner.load"><RefreshCw :size="17" /></button><button v-if="!active" class="login-button" @click="authMode='login';dialog='auth'">로그인</button><button v-else class="avatar" aria-label="계정 설정" @click="openSettings">{{ (settings.display_name || user?.email || '나').slice(0,1).toUpperCase() }}</button></div></header>
      <main>
        <div v-if="error" role="alert" class="message error"><span>{{ error }}</span><button @click="planner.load">다시 불러오기</button><button aria-label="오류 알림 닫기" @click="error=''"><X :size="16" /></button></div>
        <div v-if="notice" role="status" class="message success">{{ notice }}<button aria-label="알림 닫기" @click="notice=''"><X :size="16" /></button></div>
        <div v-if="demo" class="demo-banner"><span><Sparkles :size="14" /> 체험 모드 · 이 브라우저에만 저장됩니다</span><button v-if="featureStage >= 4" @click="authMode='login';dialog='auth'">로그인</button><button :disabled="busy" @click="planner.logout">체험 종료</button></div>
        <div v-if="!active" class="welcome-bar"><span><strong>나의 다음을 준비하는 공간</strong> 일정과 지원 자료를 한곳에서 관리하세요.</span><div><button class="text-button" @click="startDemo">체험 시작</button><button class="small-primary" @click="authMode='signup';dialog='auth'">무료로 시작하기</button></div></div>
        <section v-if="view!=='project'" class="page-heading"><div><div class="eyebrow">{{ view==='home' ? 'YOUR NEXT CHAPTER' : view==='today' ? 'MAKE TODAY COUNT' : view==='calendar' ? 'PLAN YOUR NEXT STEP' : view==='projects' ? 'BUILD YOUR NEXT CHAPTER' : 'A LITTLE HEAD START' }}</div><h1>{{ view==='home' ? '오늘을 쌓아, 내일의 커리어로' : view==='today' ? '오늘 할 일' : view==='calendar' ? '빈틈없이, 여유 있게' : view==='projects' ? '나의 다음을 향한 프로젝트' : '내일의 나를 위한 브리핑' }}<span v-if="view==='today'" class="heading-sun">☀</span></h1><p>{{ (view==='home'||view==='today') ? '학업도, 취업 준비도. 오늘은 하나씩 완성해 볼까요?' : view==='calendar' ? '학업과 커리어 준비의 균형을 달력에서 찾아보세요.' : view==='projects' ? '흩어진 준비 자료와 할 일을 하나의 흐름으로 모아보세요.' : '다가오는 일정과 중요한 할 일을 미리 살펴보세요.' }}</p></div><button class="primary-button" :disabled="loading || busy" @click="view==='projects' ? editProject() : editTask()"><Plus :size="18" />{{ view==='projects' ? '프로젝트 만들기' : '할 일 추가' }}</button></section>
        <div v-if="loading" class="loading" role="status">워크스페이스를 불러오는 중입니다…</div>
        <template v-else>
        <div v-if="view==='home'" class="overview-grid"><section class="day-hero"><div class="hero-copy"><span class="hero-label"><Sun :size="16" /> {{ formatDate(today) }}</span><h2>오늘의 가능성을<br>하나씩 채워가세요.</h2><p>완벽한 하루보다, 한 걸음 나아간 하루.</p><div class="hero-progress"><span><b>{{ doneToday }}</b> / {{ allToday.length }} 완료</span><span>{{ progress }}%</span></div><div class="progress-track" role="progressbar" aria-label="오늘 할 일 완료율" :aria-valuenow="progress" :aria-valuemin="0" :aria-valuemax="100"><span :style="{width:progress+'%'}"></span></div></div><div class="hero-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-card"><Check :size="38" :stroke-width="3" /></div><span class="art-star">✳</span><span class="art-small">✦</span></div></section><section class="stat-card"><div class="stat-icon"><ListTodo :size="21" /></div><span>오늘 남은 할 일</span><strong>{{ allToday.length-doneToday }}<small>개</small></strong><p>차근차근, 나의 속도로</p></section><section v-if="featureStage >= 3" class="stat-card"><div class="stat-icon purple"><FolderOpen :size="21" /></div><span>내 지원 프로젝트</span><strong>{{ activeProjects.length }}<small>개</small></strong><button class="stat-link" @click="go('projects')">준비 상황 살펴보기 <ArrowUpRight :size="14" /></button></section></div>
        <RoutineSchedule v-if="view==='home'" :entries="routines" :enabled="Boolean(settings.show_routine)" :today="today" :busy="busy" @toggle="toggleRoutine" @edit="editRoutine" />
        <template v-if="view==='home' || view==='today' || view==='calendar'">
<div class="content-grid" :class="{'with-calendar':view==='calendar','kanban-content':view==='today'}">
            <CalendarPanel v-if="view==='calendar'" v-model="selected" v-model:mode="calendarMode" :tasks="tasks" :today="today" />
            <section class="task-section">
<div class="section-heading"><h2>{{ view==='calendar' ? formatDate(selected) : '오늘의 할 일' }} <span class="count-pill">{{ dayTasks.length }}</span></h2><button v-if="view==='home'" class="text-button" @click="go('today')">보드로 보기</button><span v-else class="muted label-small">우선순위 순</span></div><div v-if="view!=='home'" class="list-toolbar"><div class="tabs"><button v-for="cat in ['전체',...categoryOptions]" :key="cat" :class="{active:filter===cat}" @click="filter=cat">{{ cat }}</button></div><label class="search-box"><Search :size="16" /><input v-model="search" aria-label="할 일 검색" placeholder="할 일 검색"></label></div>
              <TaskBoard v-if="view==='today'" :tasks="visibleTasks" :contexts="taskContexts" :disabled="busy" @edit="editTask" @toggle="toggle" @postpone="askPostpone" @project="openProject" @status="moveStatus" @remove="planner.trashTask" /><div v-else class="task-list"><TaskCard v-for="task in (view==='home'?homeTasks:pending)" :key="task.id" :task="task" :context="context(task)" :show-scheduling="true" :disabled="busy" @toggle="toggle(task)" @remove="planner.trashTask(task)" @edit="editTask(task)" @postpone="askPostpone(task)" @project="openProject(task)" /></div>
              <div v-if="view!=='today'&&!visibleTasks.length" class="empty-state"><div class="empty-icon"><Sun v-if="view==='home'" :size="30" /><CalendarDays v-else :size="30" /></div><h3>{{ dayTasks.length ? '검색 결과가 없어요' : '아직 비어 있는 하루예요' }}</h3><p>{{ dayTasks.length ? '다른 검색어나 분류를 선택해 보세요.' : '작은 할 일 하나로 나의 다음을 시작해 보세요.' }}</p><button v-if="!dayTasks.length" class="outline-button" @click="editTask()"><Plus :size="16" /> 첫 할 일 추가</button></div>
              <template v-if="view==='calendar'&&completed.length"><div class="completed-heading"><Check :size="16" />완료한 일 <span>{{ completed.length }}</span></div><TaskCard v-for="task in completed" :key="task.id" :task="task" :context="context(task)" :show-scheduling="true" :disabled="busy" @toggle="toggle(task)" @remove="planner.trashTask(task)" @edit="editTask(task)" @project="openProject(task)" /></template><button class="add-task-row" @click="editTask()"><Plus :size="17" /> 새로운 할 일 추가하기</button>
            </section>
            <aside v-if="view==='home'" class="right-rail"><section v-if="featureStage >= 3" class="panel project-preview"><div class="section-heading"><h3>나의 프로젝트</h3><button class="icon-button" aria-label="프로젝트 전체 보기" @click="go('projects')"><ArrowUpRight :size="17" /></button></div><button v-for="(project,i) in activeProjects.slice(0,3)" :key="project.id" class="preview-project" @click="openProjectPage(project.id)"><span class="company-logo" :class="`square-${i%3}`">{{ (project.company||project.title).slice(0,1) }}</span><span><strong>{{ project.title }}</strong><small>{{ project.deadline ? '마감 '+project.deadline.slice(5).replace('-','.') : '마감일 미정' }}</small></span></button><button v-if="!projects.length" class="add-task-row" @click="editProject()"><Plus :size="15" />프로젝트 만들기</button></section><div class="tip-card"><BookOpen :size="20" /><h3>작은 계획의 힘</h3><p>막막한 준비도 작은 할 일로 나누면<br>오늘 시작할 수 있어요.</p></div></aside>
          </div>
        </template>
        <div v-else-if="view==='projects'" class="project-collections"><section v-for="collection in [{label:'진행 중인 프로젝트',projects:activeProjects},{label:'종료된 프로젝트',projects:endedProjects}]" :key="collection.label" class="project-collection"><div class="project-collection-heading"><h2>{{ collection.label }}</h2><span class="count-pill">{{ collection.projects.length }}</span></div><div v-if="collection.projects.length" class="project-gallery"><button v-for="(project,index) in collection.projects" :key="project.id" class="project-gallery-card" @click="openProjectPage(project.id)"><span class="company-logo" :class="`square-${index%3}`">{{ (project.company||project.title).slice(0,1) }}</span><span class="project-company">{{ project.company||'지원 프로젝트' }}</span><h2>{{ project.title }}</h2><span v-if="project.archived_at" class="ended-badge">종료</span><p>{{ project.start_date||'시작일 미정' }} ~ {{ project.deadline||'마감일 미정' }}</p><div><span>일정 {{ items.filter(item=>item.project_id===project.id).length }}개</span><span>자료 {{ materials.filter(material=>material.project_id===project.id).length }}개</span></div></button></div><p v-else class="collection-empty">{{ collection.label==='종료된 프로젝트'?'종료한 프로젝트는 자료와 함께 이곳에 보관됩니다.':'현재 진행 중인 프로젝트가 없어요. 새 지원을 시작해 보세요.' }}</p></section></div>
        <section v-else-if="view==='project'&&chosenProject" class="project-page"><button class="project-back" @click="go('projects')"><ChevronLeft :size="16" />지원 프로젝트 목록</button><div class="project-top"><div><span class="eyebrow">{{ chosenProject.company||'MY NEXT CHAPTER' }}</span><h1>{{ chosenProject.title }} <span v-if="chosenProject.archived_at" class="ended-badge">종료된 프로젝트</span></h1><p v-if="chosenProject.start_date||chosenProject.deadline"><CalendarDays :size="15" />지원 기간 {{ chosenProject.start_date||'시작일 미정' }} ~ {{ chosenProject.deadline||'마감일 미정' }}</p></div><div class="project-detail-actions"><button class="outline-button" @click="editProject(chosenProject)">프로젝트 수정</button><button v-if="!chosenProject.archived_at" class="text-button" @click="dialog='archive-project'">프로젝트 종료</button><button v-else class="outline-button" :disabled="busy" @click="planner.setProjectArchived(chosenProject,false)">진행 재개</button></div></div><div class="project-tabs" role="group" aria-label="프로젝트 상세 보기"><button :aria-pressed="projectTab==='work'" @click="projectTab='work'"><CalendarDays :size="17" />일정·할 일</button><button :aria-pressed="projectTab==='materials'" @click="projectTab='materials'"><FileText :size="17" />자료 보관함 <span>{{ materials.filter(material=>material.project_id===chosenProject!.id).length }}</span></button></div><template v-if="projectTab==='work'"><div class="board"><section v-for="(stage,index) in stageList" :key="stage" class="board-column"><div class="board-heading"><h3><span class="stage-mark" :class="`stage-${index}`"></span>{{ stage }}</h3><span>{{ items.filter(i=>i.project_id===chosenProject!.id&&i.stage===stage).length }}</span></div><ProjectWorkCard v-for="item in items.filter(i=>i.project_id===chosenProject!.id&&i.stage===stage)" :key="item.id" :item="item" :work="itemWork(item)" :subtasks="ordered.filter(task=>task.project_item_id===item.id)" :disabled="busy" :title="itemTitle(item)" @edit="editItem(stage,item)" @toggle="toggle" @task="$event ? editTask($event) : addLinkedTask(item)" @restore="planner.restoreTask" /><button class="board-add" @click="editItem(stage)"><Plus :size="16" />일정 추가</button></section></div></template><ProjectArchive v-else :materials="materials.filter(material=>material.project_id===chosenProject!.id)" :busy="busy" @add="openMaterial()" @edit="openMaterial" @download="planner.downloadMaterial" /></section>
        <div v-else-if="view==='project'" class="empty-state"><h2>프로젝트를 찾지 못했습니다.</h2><button class="outline-button" @click="go('projects')">프로젝트 목록으로</button></div>
        <CalendarPanel v-if="view==='home'" v-model="overviewDate" v-model:mode="calendarMode" :tasks="tasks" :today="today" :weekly-priorities="settings.weekly_priorities" :busy="busy" overview @priorities="planner.saveWeekly" @open="selected=$event;go('calendar')" />
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
      <template v-else-if="dialog==='trash'"><div class="modal-symbol"><Trash2 :size="25" /></div><h2 id="dialog-title">휴지통</h2><p class="modal-intro">지운 할 일을 복원하면 원래 날짜·상태·프로젝트 연결로 돌아갑니다.</p><p v-if="!trash.length" class="notification-empty">휴지통이 비어 있어요.</p><div v-for="task in trash" :key="task.id" class="trash-row"><div><strong>{{ task.title }}</strong><span>실행 예정일 {{ task.scheduled_date }}</span></div><button class="outline-button" :disabled="busy" @click="planner.restoreTask(task)">복원</button></div><p v-if="error" class="form-error" role="alert">{{ error }}</p></template>
      <form v-else-if="dialog==='routine'" @submit.prevent="submitRoutine"><h2 id="dialog-title">{{ routineDraft.id?'루틴 수정':'고정 시간표 추가' }}</h2><p class="modal-intro">매주 같은 요일과 시간에 반복할 활동을 등록하세요.</p><label>활동 이름<input v-model="routineDraft.title" required maxlength="120" placeholder="예: 아침 영어 공부"></label><fieldset class="routine-day-options"><legend>반복 요일</legend><label v-for="weekday in [{id:1,label:'월'},{id:2,label:'화'},{id:3,label:'수'},{id:4,label:'목'},{id:5,label:'금'},{id:6,label:'토'},{id:0,label:'일'}]" :key="weekday.id"><input v-model="routineDraft.weekdays" type="checkbox" :value="weekday.id">{{ weekday.label }}</label></fieldset><div class="form-row"><label>시작 시간<input v-model="routineDraft.start_time" type="time" required></label><label>종료 시간<input v-model="routineDraft.end_time" type="time" required></label></div><p class="routine-form-note">같은 날 안에서 시작 시간보다 늦은 종료 시간을 선택하세요.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">시간표 저장</button><button v-if="routineDraft.id" class="demo-button" type="button" @click="dialog='delete-routine'">이 루틴 삭제</button></form>
      <template v-else-if="dialog==='delete-routine'"><h2 id="dialog-title">이 루틴을 삭제할까요?</h2><p class="modal-intro">{{ routineDraft.title }}<br>고정 시간표에서 제거됩니다. 날짜별 할 일은 유지됩니다.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="danger-button full" :disabled="busy" @click="deleteRoutine">루틴 삭제</button></template>
      <template v-else-if="dialog==='briefing'"><div class="modal-symbol"><Bell :size="25" /></div><h2 id="dialog-title">내일 일정 알림</h2><p class="modal-intro">{{ formatDate(tomorrow) }}<br>예정된 할 일 {{ briefing.planned.length }}개 중 {{ briefing.remaining.length }}개가 남아 있어요.</p><p v-if="briefing.highPriority" class="briefing-priority">높은 우선순위 {{ briefing.highPriority }}개부터 준비해 보세요.</p><div v-if="!briefing.remaining.length" class="notification-empty">내일 남은 할 일이 없어요.</div><div v-for="task in briefing.remaining" :key="task.id" class="notification-task"><span class="category" :style="categoryStyle(task.category)" :class="{academic:task.category==='학업'}">{{ task.category }}</span><button @click="editTask(task)">{{ task.title }}</button><span class="muted">{{ ['','높음','보통','낮음'][task.priority] }} 우선순위</span></div><button class="primary-button full" @click="selected=tomorrow;dialog='';go('calendar')">내일 일정 보기</button></template>
      <template v-else-if="dialog==='auth'"><div class="modal-symbol"><Leaf :size="26" /></div><h2 id="dialog-title">{{ authMode==='login' ? '다시 만나 반가워요' : authMode==='signup' ? '나의 다음을 시작해 보세요' : authMode==='update' ? '새 비밀번호 설정' : '비밀번호를 잊으셨나요?' }}</h2><p class="modal-intro">학업과 커리어 준비를 한곳에서, CareerTrack.</p><p v-if="!configured" class="config-note">Supabase 연결 설정이 필요합니다. 지금은 체험 모드에서 기능을 확인할 수 있어요.</p><form @submit.prevent="submitAuth"><label v-if="authMode!=='update'">이메일<input v-model="authForm.email" type="email" autocomplete="email" required placeholder="hello@example.com"></label><label v-if="authMode!=='reset'">비밀번호<input v-model="authForm.password" type="password" :autocomplete="authMode==='login' ? 'current-password':'new-password'" minlength="8" required placeholder="8자 이상 입력하세요"></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="notice" class="form-success" role="status">{{ notice }}</p><button class="primary-button full" :disabled="busy||!configured">{{ busy ? '처리 중…' : authMode==='login' ? '로그인' : authMode==='signup' ? '계정 만들기' : authMode==='update' ? '새 비밀번호 저장' : '재설정 메일 보내기' }}</button></form><div class="auth-links"><button @click="authMode=authMode==='signup'?'login':'signup'">{{ authMode==='signup' ? '이미 계정이 있나요? 로그인' : '처음이신가요? 회원가입' }}</button><button @click="authMode='reset'">비밀번호 찾기</button></div><button class="demo-button" @click="startDemo">계정 없이 체험하기</button></template>
      <form v-else-if="dialog==='task'" @submit.prevent="submitTask"><h2 id="dialog-title">{{ editingTask ? '할 일 수정' : '새로운 할 일' }}</h2><p class="modal-intro">작게 나누고, 가볍게 시작해 보세요.</p><label>할 일 이름<input v-model="draftTask.title" required maxlength="200" autofocus placeholder="예: 자기소개서 1번 문항 초안 쓰기"></label><div class="form-row"><label>실행 예정일<input v-model="draftTask.scheduled_date" type="date" required></label><label>제출 마감일 <span class="optional">선택</span><input v-model="draftTask.deadline" type="date"></label></div><div class="form-row"><label>분류<select v-model="draftTask.category"><option v-for="category in categoryOptions" :key="category" :value="category">{{ category }}</option><option value="__custom">직접 입력</option></select></label><label>우선순위<select v-model="draftTask.priority"><option :value="1">높음</option><option :value="2">보통</option><option :value="3">낮음</option></select></label></div><label v-if="draftTask.category==='__custom'">분류 직접 입력<input v-model="customCategory" required maxlength="40" placeholder="예: 자격증, 동아리, 어학 공부"></label><label v-if="editingTask">진행 상태<select v-model="draftTask.status"><option value="todo">할 일</option><option value="in_progress">진행 중</option><option value="done">완료</option></select></label><label>프로젝트 연결 <span class="optional">선택</span><select v-model="taskProjectId" @change="draftTask.project_item_id=''"><option value="">개인 일정 · 연결하지 않음</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option></select></label><template v-if="taskProjectId"><label>프로젝트 항목<select v-model="draftTask.project_item_id"><option value="">새 카드로 함께 등록</option><option v-for="item in items.filter(item=>item.project_id===taskProjectId)" :key="item.id" :value="item.id">{{ item.stage }} · {{ itemTitle(item) }}</option></select></label><label v-if="!draftTask.project_item_id">등록 단계<select v-model="taskStage"><option v-for="stage in stageList" :key="stage">{{ stage }}</option></select></label></template><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">{{ busy ? '저장 중…' : '할 일 저장' }}</button></form>
      <form v-else-if="dialog==='project'" @submit.prevent="submitProject"><h2 id="dialog-title">{{ draftProject.id ? '프로젝트 수정' : '새 지원 프로젝트' }}</h2><p class="modal-intro">하나의 목표에 필요한 준비를 모아보세요.</p><label>프로젝트 이름<input v-model="draftProject.title" required maxlength="200" placeholder="예: 올리브영 신입 공채"></label><label>기업명 <span class="optional">선택</span><input v-model="draftProject.company" maxlength="200" placeholder="예: CJ 올리브영"></label><div class="form-row"><label>지원 시작일 <span class="optional">선택</span><input v-model="draftProject.start_date" type="date"></label><label>지원 마감일 <span class="optional">선택</span><input v-model="draftProject.deadline" type="date" :min="draftProject.start_date||undefined"></label></div><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">{{ busy ? '저장 중…' : '프로젝트 저장' }}</button></form>
      <form v-else-if="dialog==='item'" @submit.prevent="submitItem"><h2 id="dialog-title">프로젝트 일정</h2><p class="modal-intro">언제 할 일인지 정하고, 필요한 메모만 짧게 남기세요.</p><div class="form-row schedule-name-row"><label>할 일 이름<input v-model="draftItem.title" required maxlength="200"></label><label>준비 단계<select v-model="draftItem.stage"><option v-for="stage in stageList" :key="stage">{{ stage }}</option></select></label></div><div class="form-row"><label>실행 예정일<input v-model="draftItem.scheduled_date" type="date" required></label><label>마감일 <span class="optional">선택</span><input v-model="draftItem.deadline" type="date"></label></div><p class="routine-form-note">오늘 할 일과 달력에도 같은 일정으로 반영됩니다.</p><label>메모 <span class="optional">선택</span><textarea v-model="draftItem.content" rows="3" maxlength="1000" placeholder="예: 1번 문항은 팀 프로젝트 경험으로 작성하기"></textarea></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">일정 저장</button></form>
      <form v-else-if="dialog==='postpone'" @submit.prevent="submitPostpone"><h2 id="dialog-title">다른 날에 이어서 할까요?</h2><p class="modal-intro">{{ postponed?.title }}<br>제출 마감일과 프로젝트 연결은 유지됩니다.</p><label>새 실행 예정일<input v-model="nextDate" type="date" required></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" :disabled="busy">날짜 변경</button></form>

      <form v-else-if="dialog==='settings'" @submit.prevent="planner.saveSettings(timezone,displayName)"><h2 id="dialog-title">워크스페이스 설정</h2><p class="modal-intro">{{ demo ? '브라우저 체험 모드' : user?.email }}</p><label>이름<input v-model="displayName" maxlength="80" placeholder="나를 부를 이름"></label><label>시간대<select v-model="timezone"><option value="Asia/Seoul">서울 (Asia/Seoul)</option><option value="Asia/Tokyo">도쿄 (Asia/Tokyo)</option><option value="America/New_York">뉴욕 (America/New_York)</option><option value="America/Los_Angeles">로스앤젤레스 (America/Los_Angeles)</option><option value="Europe/London">런던 (Europe/London)</option><option value="UTC">UTC</option></select></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="notice" class="form-success" role="status">{{ notice }}</p><button class="primary-button full" :disabled="busy">설정 저장</button><button class="demo-button" type="button" :disabled="busy" @click="planner.logout().then(ok=>{if(ok)dialog=''})"><LogOut :size="15" />{{ demo ? '체험 종료' : '로그아웃' }}</button></form>
      <template v-else><h2 id="dialog-title">CareerTrack 사용 안내</h2><div class="help-copy"><p>할 일을 실행할 날짜와 제출 마감일을 각각 지정하세요. 날짜별 일정에서 지난 일정도 수정할 수 있습니다.</p><p>지원 프로젝트를 만들고 준비·진행·마감 단계에 자료 항목을 추가하세요. 할 일을 자료에 연결하면 어느 화면에서든 같은 완료 상태가 보입니다.</p><p>다른 날로 미루기는 실행 날짜만 바꾸며, 내일 브리핑은 저장된 최신 일정을 보여줍니다.</p><p>체험 데이터는 이 브라우저에 저장됩니다. 실제 계정으로 로그인하면 세 시안에서 같은 Supabase 데이터를 사용할 수 있습니다.</p></div></template>
    </section>
</div>
  </div>
</template>
