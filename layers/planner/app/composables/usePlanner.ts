import { computed, ref } from 'vue'
import { useRuntimeConfig } from '#imports'
import { createClient, type User } from '@supabase/supabase-js'
import { dateInZone, shiftDate, sortTasks, taskStatus, validRoutine, attachmentError, validWeeklyPriorities, type Task, type Project, type ProjectItem, type UserSettings, type RoutineEntry, type ProjectMaterial } from '../../shared/domain'

import { publicConfigError } from '../../shared/config'
import { isTask, isProject, isItem, isMaterial, readLocal, writeLocal, type PlannerData } from '../../shared/storage'

import { putLocalFile, getLocalFile, removeLocalFile } from './localFiles'
type Entity = Task | Project | ProjectItem | RoutineEntry | ProjectMaterial

export function usePlanner() {
  const config = useRuntimeConfig().public
  const configIssue = publicConfigError(String(config.supabaseUrl), String(config.supabaseKey))
  const configured = Boolean(config.supabaseUrl && config.supabaseKey && !configIssue)
  const client = configured ? createClient(String(config.supabaseUrl), String(config.supabaseKey)) : null
  const user = ref<User | null>(null)
  const recovery = ref(false)
  const demo = ref(false), loading = ref(false), busy = ref(false), error = ref(configIssue), notice = ref('')
  const materials=ref<ProjectMaterial[]>([])
  const routines=ref<RoutineEntry[]>([])
  const tasks = ref<Task[]>([]), projects = ref<Project[]>([]), items = ref<ProjectItem[]>([])
  const settings = ref<UserSettings>({ user_id: '', timezone: 'Asia/Seoul', display_name: '' })
  const now = ref(new Date())
  const today = computed(() => dateInZone(now.value, settings.value.timezone))
  const tomorrow = computed(() => shiftDate(today.value, 1))
  const owner = () => { if (demo.value) return 'demo'; if (user.value) return user.value.id; throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.') }
  let storageBlocked = false
  function snapshot(): PlannerData { return { materials:materials.value, routines:routines.value, tasks: tasks.value, projects: projects.value, items: items.value, settings: settings.value } }
  function persist(data = snapshot()) {
    if (storageBlocked) throw new Error('저장 자료를 읽지 못해 원본 보호를 위해 저장을 중단했습니다. 다시 불러온 후 시도하세요.')
    writeLocal(localStorage, data)
  }
  function applyLocal(data: PlannerData) { materials.value=data.materials; routines.value=data.routines; tasks.value = data.tasks; projects.value = data.projects; items.value = data.items; settings.value = data.settings }
  const clear = () => { materials.value=[]; routines.value=[]; tasks.value = []; projects.value = []; items.value = []; settings.value = { user_id: '', timezone: 'Asia/Seoul', display_name: '' } }
  async function run(action: () => Promise<void>) {
    if (busy.value) return false
    busy.value = true; error.value = ''; notice.value = ''
    try { await action(); return true } catch (e) { error.value = e instanceof Error ? e.message : (e as { message?: string }).message || '요청을 처리하지 못했습니다. 다시 시도해 주세요.'; return false } finally { busy.value = false }
  }
  let loadSequence = 0
  let disposed = false
  async function load() {
    if (demo.value) { startDemo(); return }
    if (!client || !user.value) return
    const currentUser = user.value.id
    const request = ++loadSequence
    loading.value = true; error.value = ''
    try {
      const results = await Promise.all([client.from('tasks').select('*').eq('user_id', currentUser), client.from('projects').select('*').eq('user_id', currentUser), client.from('project_items').select('*').eq('user_id', currentUser), client.from('user_settings').select('*').eq('user_id', currentUser).maybeSingle(),client.from('routines').select('*').eq('user_id',currentUser),client.from('project_materials').select('*').eq('user_id',currentUser)])
      if (disposed || request !== loadSequence || user.value?.id !== currentUser || demo.value) return
      for (const r of results) if (r.error) throw r.error
      materials.value=results[5].data as unknown as ProjectMaterial[]
      routines.value=results[4].data as unknown as RoutineEntry[]
      tasks.value = results[0].data as unknown as Task[]; projects.value = results[1].data as unknown as Project[]; items.value = results[2].data as unknown as ProjectItem[]
      settings.value = results[3].data ? results[3].data as unknown as UserSettings : {user_id:currentUser,timezone:'Asia/Seoul',display_name:''}
    } catch (e) { if (request !== loadSequence || user.value?.id !== currentUser) return; error.value = `데이터를 불러오지 못했습니다. ${e instanceof Error ? e.message : (e as {message?:string}).message || '연결 설정을 확인해 주세요.'}` } finally { if (request === loadSequence) loading.value = false }
  }
  async function init() {
    const syncLocal = () => { if (demo.value) startDemo() }
    if (typeof window !== 'undefined') window.addEventListener('storage', syncLocal)
    const stopLocal = () => { if (typeof window !== 'undefined') window.removeEventListener('storage', syncLocal) }
    const clock = setInterval(() => { now.value = new Date() }, 30000)
    if (!client) { startDemo(); return () => { disposed = true; stopLocal(); clearInterval(clock) } }
    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      const previous = user.value?.id
      const nextUser = session?.user || null
      if (previous !== nextUser?.id) { ++loadSequence; clear() }
      user.value = nextUser
      if (event === 'PASSWORD_RECOVERY') recovery.value = true
      if (!session && !demo.value) {
        loading.value = false
        if (previous) error.value = '로그인이 종료되었습니다. 다시 로그인해 주세요.'
      }
      if (session) {
        demo.value = false
        sessionStorage.removeItem('career-local-active')
        setTimeout(() => { if (!disposed) void load() }, 0)
      }
    })
    const { data, error: authError } = await client.auth.getSession()
    if (!disposed) {
      if (authError) error.value = authError.message
      user.value = data.session?.user || null
      if (user.value) await load()
      else if (sessionStorage.getItem('career-local-active') === 'yes') startDemo()
    }
    return () => { disposed = true; stopLocal(); ++loadSequence; clearInterval(clock); subscription.subscription.unsubscribe() }
  }
  async function auth(mode: string, email: string, password: string) {
    return run(async () => {
      if (!client) throw new Error('Supabase 연결 정보가 아직 설정되지 않았습니다. 체험 모드를 이용할 수 있습니다.')
      const redirectTo = window.location.origin + '/?recovery=1'
      const result = mode === 'signup' ? await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : mode === 'reset' ? await client.auth.resetPasswordForEmail(email, { redirectTo })
          : mode === 'update' ? await client.auth.updateUser({ password }) : await client.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      if (mode === 'update') recovery.value = false
      notice.value = mode === 'signup' ? '가입 요청을 완료했습니다. 이메일 확인이 필요한 경우 받은 편지함을 확인하세요.' : mode === 'reset' ? '비밀번호 재설정 메일을 요청했습니다. 받은 편지함을 확인하세요.' : mode === 'update' ? '비밀번호를 변경했습니다.' : '로그인했습니다.'
    })
  }
  async function logout() {
    return run(async () => {
      ++loadSequence
      if (client && !demo.value) { const r = await client.auth.signOut(); if (r.error) throw r.error }
      sessionStorage.removeItem('career-local-active'); user.value = null; demo.value = false; clear()
    })
  }
  function startDemo() {
    if (user.value) return
    try {
      const data = readLocal(localStorage)
      storageBlocked = false; applyLocal(data); demo.value = true
      sessionStorage.setItem('career-local-active', 'yes')
    } catch (e) {
      storageBlocked = true; demo.value = true
      error.value = e instanceof Error ? e.message : '저장 자료를 읽지 못했습니다. 원본은 보존했습니다.'
    }
  }
  async function save(table: 'tasks'|'projects'|'project_items'|'routines'|'project_materials', value: Entity) {
    if (table === 'tasks' && (value as Task).status === undefined) value = { ...value, status: taskStatus(value as Task) } as Task
    const valid = table === 'tasks' ? isTask(value) : table === 'projects' ? isProject(value) : table === 'project_items' ? isItem(value) : table === 'routines' ? validRoutine(value) : isMaterial(value)
    if (!valid) throw new Error(table === 'routines' ? '활동 이름과 반복 요일을 확인하고, 종료 시간을 시작 시간보다 늦게 입력해 주세요.' : '입력 내용을 확인해 주세요. 이름, 날짜, 우선순위가 올바르게 입력되어야 합니다.')
    const currentOwner = owner()
    if (value.user_id !== currentOwner) throw new Error('다른 사용자의 자료는 저장할 수 없습니다.')
    const list = table === 'tasks' ? tasks : table === 'projects' ? projects : table === 'project_items' ? items : table === 'routines' ? routines : materials
    if (demo.value) {
      const current = readLocal(localStorage)
      const field = table === 'project_items' ? 'items' : table === 'project_materials' ? 'materials' : table
      const updated = [...current[field]] as Entity[]
      const index = updated.findIndex(v => v.id === value.id)
      if (index < 0) updated.push(value); else updated[index] = value
      const next = { ...current, [field]: updated } as PlannerData
      persist(next); applyLocal(next)
    } else {
      if (!client || !user.value) throw new Error('로그인 후 저장할 수 있습니다.')
      const { data, error: saveError } = await client.from(table).upsert(value as unknown as Record<string, unknown>).select('*').single()
      if (saveError) throw saveError
      if (!data) throw new Error('저장 결과를 확인하지 못했습니다. 다시 시도해 주세요.')
      if (user.value?.id !== currentOwner) return
      const saved = data as unknown as Entity
      const updated = [...list.value] as Entity[]
      const index = updated.findIndex(record => record.id === saved.id)
      if (index < 0) updated.push(saved); else updated[index] = saved
      if (table === 'tasks') tasks.value = updated as Task[]
      else if (table === 'projects') projects.value = updated as Project[]
      else if(table === 'project_items') items.value = updated as ProjectItem[]
      else if(table === 'routines') routines.value=updated as RoutineEntry[]
      else materials.value=updated as ProjectMaterial[]
    }
  }
  async function saveSettings(timezone: string, display_name: string, show_routine = settings.value.show_routine || false) {
    return run(async () => {
      dateInZone(new Date(), timezone)
      const value = { user_id: owner(), timezone, display_name, show_routine }
      if (demo.value) { const current=readLocal(localStorage); const next = { ...current, settings: {...current.settings,...value} }; persist(next); applyLocal(next) }
      else { const r = await client!.from('user_settings').upsert(value); if (r.error) throw r.error; settings.value = {...settings.value,...value} }
      notice.value = '설정을 저장했습니다.'
    })
  }
  async function setProjectArchived(project:Project,archive:boolean){
    return run(async()=>{await save('projects',{...project,archived_at:archive?new Date().toISOString():null});notice.value=archive?'종료된 프로젝트로 보관했습니다. 자료와 일정은 그대로 유지됩니다.':'프로젝트를 다시 진행 중으로 옮겼습니다.'})
  }
  async function saveWeekly(week:string,priorities:string[]){
    return run(async()=>{
      const entries=priorities.map(value=>value.trim())
      if(!validWeeklyPriorities({[week]:entries}))throw new Error('우선순위는 한 주에 세 개, 각 200자까지 입력해 주세요.')
      if(demo.value){const current=readLocal(localStorage);const next={...current,settings:{...current.settings,weekly_priorities:{...current.settings.weekly_priorities,[week]:entries}}};persist(next);applyLocal(next)}
      else{owner();const result=await client!.rpc('set_weekly_priorities',{p_week:week,p_priorities:entries});if(result.error)throw result.error;settings.value=result.data as UserSettings}
      notice.value='주간 우선순위를 저장했습니다.'
    })
  }
  async function saveMaterial(material:ProjectMaterial,file?:File){
    let uploaded=''
    let next={...material}
    if(file){
      const issue=attachmentError(file);if(issue)throw new Error(issue)
      const extension=file.name.split('.').pop()!.toLowerCase()
      uploaded=`${owner()}/${material.project_id}/${material.id}/${crypto.randomUUID()}.${extension}`
      if(demo.value)await putLocalFile(uploaded,file)
      else{const result=await client!.storage.from('careertrack-materials').upload(uploaded,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(result.error)throw result.error}
      next={...material,file_name:file.name,file_size:file.size,file_type:file.type||'application/octet-stream',storage_path:uploaded}
    }
    try{await save('project_materials',next)}catch(e){
      if(uploaded){try{if(demo.value)await removeLocalFile(uploaded);else await client!.storage.from('careertrack-materials').remove([uploaded])}catch{/* A failed cleanup never masks the original save error. */}}
      throw e
    }
    notice.value='프로젝트 자료를 저장했습니다.'
  }
  async function downloadMaterial(material:ProjectMaterial){
    return run(async()=>{
      if(!material.storage_path)throw new Error('첨부 파일이 없습니다.')
      let file:Blob
      if(demo.value)file=await getLocalFile(material.storage_path)
      else{const result=await client!.storage.from('careertrack-materials').download(material.storage_path);if(result.error)throw result.error;file=result.data}
      const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=material.file_name||'첨부파일';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)
    })
  }
  async function saveProjectWork(item: ProjectItem, task: Task) {
    const currentOwner=owner()
    const work={...task,status:taskStatus(task)}
    if(!isItem(item)||!isTask(work)||item.user_id!==currentOwner||work.user_id!==currentOwner||work.project_item_id!==item.id)throw new Error('프로젝트와 일정의 연결 정보를 확인해 주세요.')
    if(demo.value){
      const current=readLocal(localStorage)
      const next={...current,items:[...current.items.filter(value=>value.id!==item.id),item],tasks:[...current.tasks.filter(value=>value.id!==work.id),work]}
      persist(next);applyLocal(next)
    }else{
      if(!client||!user.value)throw new Error('로그인 후 저장할 수 있습니다.')
      const {data,error:saveError}=await client.rpc('save_project_work',{p_item:item,p_task:work})
      if(saveError)throw saveError
      if(!data)throw new Error('프로젝트 일정 저장 결과를 확인하지 못했습니다.')
      if(user.value?.id!==currentOwner)return
      const saved=data as {item:ProjectItem;task:Task}
      items.value=[...items.value.filter(value=>value.id!==saved.item.id),saved.item]
      tasks.value=[...tasks.value.filter(value=>value.id!==saved.task.id),saved.task]
    }
  }
  async function trashTask(task: Task) {
    return run(async()=>{await save('tasks',{...task,deleted_at:new Date().toISOString()});notice.value='할 일을 휴지통으로 옮겼습니다. 휴지통에서 복원할 수 있습니다.'})
  }
  async function restoreTask(task: Task) {
    return run(async()=>{await save('tasks',{...task,deleted_at:null});notice.value='할 일을 원래 날짜와 상태로 복원했습니다.'})
  }
  async function removeRoutine(id: string) {
    return run(async()=>{
      if(demo.value){const current=readLocal(localStorage);const next={...current,routines:current.routines.filter(entry=>entry.id!==id)};persist(next);applyLocal(next)}
      else{const currentOwner=owner();const result=await client!.from('routines').delete().eq('id',id).eq('user_id',currentOwner);if(result.error)throw result.error;routines.value=routines.value.filter(entry=>entry.id!==id)}
    })
  }
  function stamp() { return { id: crypto.randomUUID(), user_id: owner(), created_at: new Date().toISOString() } }
  async function addExamples() {
    return run(async () => {
      const project: Project = { ...stamp(), title: '올리브영 신입 공채', company: 'CJ 올리브영', deadline: shiftDate(today.value, 12) }
      await save('projects', project)
      const examples = [
        ['자기소개서', '준비', '나를 가장 잘 보여주는 경험 3가지를 정리해 보세요.'],
        ['포트폴리오', '진행', '문제 정의 · 나의 역할 · 결과가 잘 드러나는지 점검하기'],
        ['지원서 제출', '마감', '최종 파일과 제출 완료 메일 확인하기'],
      ] as const
      const made: ProjectItem[] = []
      for (const [title, stage, content] of examples) { const item = { ...stamp(), project_id: project.id, title, stage, content }; await save('project_items', item); made.push(item) }
      const data = [
        ['자기소개서 1번 문항 초안 쓰기', 1, '취업 준비', made[0]!.id, 0],
        ['마케팅원론 팀 프로젝트 자료 조사', 2, '학업', null, 0],
        ['포트폴리오 프로젝트 성과 정리', 1, '취업 준비', made[1]!.id, 0],
        ['오늘 배운 내용 10분 복습', 3, '개인', null, 0],
        ['포트폴리오 최종 검토', 1, '취업 준비', made[1]!.id, 1],
        ['지원 기업의 최근 소식 읽기', 2, '취업 준비', made[0]!.id, 1],
      ] as const
      for (const [title, priority, category, project_item_id, offset] of data) await save('tasks', { ...stamp(), title, priority, category, project_item_id, scheduled_date: shiftDate(today.value, offset), deadline: category === '취업 준비' ? project.deadline : null, completed: false })
      notice.value = '예시 프로젝트와 할 일을 추가했습니다.'
    })
  }
  return { setProjectArchived, saveWeekly, materials, saveMaterial, downloadMaterial, routines, removeRoutine, configured, recovery, user, demo, tasks:computed(()=>tasks.value.filter(task=>!task.deleted_at)), trash:computed(()=>tasks.value.filter(task=>Boolean(task.deleted_at))), trashTask, restoreTask, projects, items, settings, today, tomorrow, busy, loading, error, notice, init, load, auth, logout, startDemo, save, saveProjectWork, run, stamp, saveSettings, addExamples, ordered: computed(() => sortTasks(tasks.value.filter(task=>!task.deleted_at))) }
}
