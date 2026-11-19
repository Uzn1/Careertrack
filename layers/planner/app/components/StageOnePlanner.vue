<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRuntimeConfig } from '#imports'
import { CalendarDays, Check, Leaf, Plus, Sun, X } from 'lucide-vue-next'
import { dateInZone, formatDate, sortTasks, type Task } from '../../shared/domain'

const variant = String(useRuntimeConfig().public.variant)
const storageKey = 'career-planner-stage-one-v1'
const tasks = ref<Task[]>([])
const now = ref(new Date())
const today = computed(() => dateInZone(now.value))
const dayTasks = computed(() => sortTasks(tasks.value.filter(task => task.scheduled_date === today.value)))
const pending = computed(() => dayTasks.value.filter(task => !task.completed))
const completed = computed(() => dayTasks.value.filter(task => task.completed))
const progress = computed(() => dayTasks.value.length ? Math.round(completed.value.length / dayTasks.value.length * 100) : 0)
const ready = ref(false)
const error = ref('')
const dialog = ref(false)
const dialogElement = ref<HTMLElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const draft = reactive({ id: '', title: '', deadline: '', priority: 2, category: '취업 준비' })
let previousFocus: HTMLElement | null = null
let timer: ReturnType<typeof setInterval> | undefined

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false
  const task = value as Partial<Task>
  return typeof task.id === 'string' && typeof task.title === 'string' && typeof task.created_at === 'string'
    && typeof task.scheduled_date === 'string' && (task.deadline === null || typeof task.deadline === 'string')
    && [1, 2, 3].includes(Number(task.priority)) && typeof task.completed === 'boolean'
    && ['취업 준비', '학업', '개인'].includes(String(task.category))
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks.value))
    error.value = ''
  } catch {
    error.value = '브라우저에 저장하지 못했습니다. 현재 화면의 내용은 유지되지만 새로고침하면 사라질 수 있습니다.'
  }
}

function edit(task?: Task) {
  previousFocus = document.activeElement as HTMLElement | null
  Object.assign(draft, task
    ? { id: task.id, title: task.title, deadline: task.deadline || '', priority: task.priority, category: task.category }
    : { id: '', title: '', deadline: '', priority: 2, category: '취업 준비' })
  dialog.value = true
  void nextTick(() => titleInput.value?.focus())
}

function close() {
  dialog.value = false
  void nextTick(() => previousFocus?.focus())
}

function save() {
  const title = draft.title.trim()
  if (!title) { titleInput.value?.focus(); return }
  const existing = tasks.value.find(task => task.id === draft.id)
  const value: Task = {
    ...(existing || { id: crypto.randomUUID(), user_id: 'local', created_at: new Date().toISOString(), scheduled_date: today.value, completed: false, project_item_id: null }),
    title, deadline: draft.deadline || null, priority: Number(draft.priority), category: draft.category as Task['category'],
  }
  tasks.value = existing ? tasks.value.map(task => task.id === value.id ? value : task) : [...tasks.value, value]
  persist()
  close()
}

function toggle(task: Task) {
  tasks.value = tasks.value.map(value => value.id === task.id ? { ...value, completed: !value.completed } : value)
  persist()
}

function handleKeys(event: KeyboardEvent) {
  if (!dialog.value) return
  if (event.key === 'Escape') { close(); return }
  if (event.key !== 'Tab') return
  const controls = dialogElement.value?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')
  if (!controls?.length) return
  const first = controls[0]!, last = controls[controls.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

watch(dialog, value => { document.body.style.overflow = value ? 'hidden' : '' })
onMounted(() => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const stored: unknown = JSON.parse(raw)
      if (!Array.isArray(stored) || !stored.every(isTask)) throw new Error('Invalid saved tasks')
      tasks.value = stored
    }
  } catch {
    error.value = '저장된 할 일을 읽지 못했습니다. 브라우저의 저장 설정을 확인해 주세요. 기존 저장 내용은 그대로 두었습니다.'
  }
  ready.value = true
  timer = setInterval(() => { now.value = new Date() }, 30000)
  document.addEventListener('keydown', handleKeys)
})
onUnmounted(() => { clearInterval(timer); document.removeEventListener('keydown', handleKeys); document.body.style.overflow = '' })
</script>

<template>
  <div class="planner stage-one" :class="`variant-${variant}`">
    <aside class="sidebar">
      <a href="/" class="brand"><span class="brand-icon"><Leaf :size="23" /></span>다음<span class="brand-dot">.</span></a>
      <div class="workspace-label">MY CAREER WORKSPACE</div>
      <nav aria-label="주 메뉴"><button class="active" aria-current="page"><Sun :size="19" />오늘 할 일<span class="nav-count">{{ pending.length }}</span></button></nav>
      <div class="sidebar-bottom"><div class="growth-note"><span class="growth-sprout"><Leaf :size="28" /></span><strong>조금씩, 꾸준히 자라는 나</strong><p>오늘의 작은 계획이<br>내일의 커리어가 됩니다.</p></div></div>
    </aside>
    <div class="main-shell">
      <header class="topbar"><div class="breadcrumb"><Leaf :size="18" /><strong>다음 · 오늘 할 일</strong></div><span class="stage-storage-label">이 브라우저에 저장</span></header>
      <main>
        <div v-if="error" class="message error" role="alert">{{ error }}<button @click="persist">저장 다시 시도</button></div>
        <section class="page-heading"><div><div class="eyebrow">MAKE TODAY COUNT</div><h1>좋은 하루의 시작, 오늘 할 일<span class="heading-sun">☀</span></h1><p>학업도, 취업 준비도. 오늘은 하나씩 완성해 볼까요?</p></div><button class="primary-button" :disabled="!ready" @click="edit()"><Plus :size="18" />할 일 추가</button></section>
        <div class="overview-grid stage-overview">
          <section class="day-hero"><div class="hero-copy"><span class="hero-label"><Sun :size="16" />{{ formatDate(today) }}</span><h2>오늘의 가능성을<br>하나씩 채워가세요.</h2><p>완벽한 하루보다, 한 걸음 나아간 하루.</p><div class="hero-progress"><span><b>{{ completed.length }}</b> / {{ dayTasks.length }} 완료</span><span>{{ progress }}%</span></div><div class="progress-track" role="progressbar" aria-label="오늘 할 일 완료율" :aria-valuenow="progress" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: progress + '%' }"></span></div></div><div class="hero-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-card"><Check :size="38" :stroke-width="3" /></div><span class="art-star">✳</span><span class="art-small">✦</span></div></section>
          <section class="stat-card"><div class="stat-icon"><Sun :size="21" /></div><span>오늘 남은 할 일</span><strong>{{ pending.length }}<small>개</small></strong><p>차근차근, 나의 속도로</p></section>
        </div>
        <div class="content-grid stage-content">
          <section class="task-section">
<div class="section-heading"><h2>오늘의 할 일 <span class="count-pill">{{ dayTasks.length }}</span></h2><span class="muted label-small">높은 우선순위부터 · 같은 순위는 등록 순</span></div>
            <p v-if="!ready" role="status" class="loading">저장한 할 일을 불러오는 중입니다.</p>
            <template v-else>
              <div class="task-list"><TaskCard v-for="task in pending" :key="task.id" :task="task" :show-scheduling="false" @toggle="toggle(task)" @edit="edit(task)" /></div>
              <div v-if="!dayTasks.length" class="empty-state"><div class="empty-icon"><Sun :size="30" /></div><h3>아직 비어 있는 하루예요</h3><p>작은 할 일 하나로 나의 다음을 시작해 보세요.</p><button class="outline-button" @click="edit()"><Plus :size="16" />첫 할 일 추가</button></div>
              <template v-if="completed.length"><div class="completed-heading"><Check :size="16" />완료한 일 <span>{{ completed.length }}</span></div><TaskCard v-for="task in completed" :key="task.id" :task="task" :show-scheduling="false" @toggle="toggle(task)" @edit="edit(task)" /></template>
              <button class="add-task-row" @click="edit()"><Plus :size="17" />새로운 할 일 추가하기</button>
            </template>
          </section>
          <aside class="right-rail"><section class="panel"><div class="section-heading"><h3><CalendarDays :size="17" />오늘을 가볍게 만드는 계획</h3></div><p class="stage-note">실행할 날짜는 오늘로 저장됩니다. 제출 마감일은 별도로 적을 수 있어요.</p><p class="stage-note">중요한 일부터 시작하고, 끝낸 일은 체크해 보세요. 완료한 일은 아래에 모아 보여드립니다.</p></section><section class="panel"><h3>현재 저장 방식</h3><p class="stage-note">할 일은 이 브라우저에만 저장됩니다. 로그인과 다른 기기에서 이어 보기는 다음 개발 단계에서 연결합니다.</p></section></aside>
        </div>
        <footer><span>다음<span class="brand-dot">.</span> 오늘의 작은 계획, 내일의 가능성.</span><span>1단계 · 오늘 할 일</span></footer>
      </main>
    </div>
    <div v-if="dialog" class="modal-backdrop" @click.self="close">
      <section ref="dialogElement" class="modal" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
        <button class="modal-close icon-button" aria-label="닫기" @click="close"><X :size="21" /></button>
        <form @submit.prevent="save">
<h2 id="task-dialog-title">{{ draft.id ? '할 일 수정' : '새로운 할 일' }}</h2><p class="modal-intro">{{ formatDate(today) }}에 할 일을 적어보세요.</p>
          <label>할 일 이름<input ref="titleInput" v-model="draft.title" required maxlength="200" placeholder="예: 자기소개서 초안 쓰기"></label>
          <div class="form-row"><label>분류<select v-model="draft.category"><option>취업 준비</option><option>학업</option><option>개인</option></select></label><label>우선순위<select v-model="draft.priority"><option :value="1">높음</option><option :value="2">보통</option><option :value="3">낮음</option></select></label></div>
          <label>제출 마감일 <span class="optional">선택</span><input v-model="draft.deadline" type="date"></label>
          <button class="primary-button full" type="submit">할 일 저장</button>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.stage-overview { grid-template-columns: minmax(0, 2.5fr) minmax(180px, 1fr); }
.stage-content { margin-top: 32px; }
.stage-storage-label { font-size: 13px; color: #71816c; }
.stage-note { font-size: 14px; color: #73816e; line-height: 1.9; margin-top: 16px; }
@media(max-width:767px) {
  .stage-overview { grid-template-columns: 1fr; }
  .stage-overview .day-hero { grid-column: auto; }
  .stage-overview .stat-card { display: none; }
  .stage-content .right-rail { margin-top: 15px; }
  .label-small { max-width: 160px; text-align: right; line-height: 1.7; }
}
</style>
