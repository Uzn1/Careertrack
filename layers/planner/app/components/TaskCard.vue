<script setup lang="ts">
import { Check, MoreHorizontal, CalendarDays, Pencil, Clock3, Trash2, FolderOpen } from 'lucide-vue-next'
import { ref } from 'vue'
import type { Task } from '../../shared/domain'
defineProps<{ task: Task; context?: string; disabled?: boolean; showScheduling?: boolean }>()
const emit = defineEmits<{ toggle: []; edit: []; postpone: []; remove: []; project: [] }>()
const menu = ref(false)
</script>
<template>
  <article class="task-card" :class="{ 'is-done': task.completed }">
    <button class="check-task" :class="{ checked: task.completed }" :disabled="disabled" :aria-label="`${task.title} ${task.completed ? '완료 취소' : '완료'}`" :aria-pressed="task.completed" @click="emit('toggle')"><Check v-if="task.completed" :size="16" /></button>
    <div class="task-body">
      <div class="task-labels"><span class="category" :class="{ academic: task.category === '학업', personal: task.category === '개인' }">{{ task.category }}</span><span class="priority" :class="`p${task.priority}`">{{ ['','높음','보통','낮음'][task.priority] }} 우선순위</span></div>
      <button class="task-title" @click="emit('edit')">{{ task.title }}</button>
      <div class="task-meta"><button v-if="context" class="context-link" @click="emit('project')"><FolderOpen :size="13" />{{ context }}</button><span v-if="task.deadline"><CalendarDays :size="13" /> 마감 {{ task.deadline.slice(5).replace('-', '.') }}</span><span v-if="task.completed">완료됨</span></div>
    </div>
    <div class="task-actions">
<button class="icon-button" aria-label="할 일 수정" @click="emit('edit')"><Pencil :size="15" /></button><button v-if="showScheduling !== false" class="icon-button" aria-label="할 일 메뉴" :aria-expanded="menu" @click="menu = !menu"><MoreHorizontal :size="20" /></button>
      <div v-if="menu" class="task-menu"><button v-if="!task.completed" @click="menu=false;emit('postpone')"><Clock3 :size="15" /> 다른 날로 미루기</button><button @click="menu=false;emit('remove')"><Trash2 :size="15" /> 삭제하기</button><button @click="menu=false">메뉴 닫기</button></div>
    </div>
  </article>
</template>
