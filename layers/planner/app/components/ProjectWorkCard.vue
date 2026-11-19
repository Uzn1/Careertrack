<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays, Check, Plus } from 'lucide-vue-next'
import type { Task, ProjectItem } from '../../shared/domain'
const props=defineProps<{item:ProjectItem;work?:Task;subtasks:Task[];disabled:boolean;title:string}>()
const emit=defineEmits<{edit:[];toggle:[task:Task];task:[task?:Task];restore:[task:Task]}>()
const deadline=computed(()=>props.work?props.work.deadline:props.item.deadline)
const children=computed(()=>props.subtasks.filter(task=>task.id!==props.work?.id))
</script>
<template>
  <article class="board-card project-work-card">
    <div class="project-work-title"><button v-if="work&&!work.deleted_at" class="check-task" :class="{checked:work.completed}" :disabled="disabled" :aria-label="title+' 완료 전환'" :aria-pressed="work.completed" @click="emit('toggle',work)"><Check v-if="work.completed" :size="13" /></button><button class="board-title" :class="{struck:work?.completed}" @click="emit('edit')">{{ title }}</button></div>
    <button class="project-work-dates" @click="emit('edit')"><CalendarDays :size="14" /><span v-if="work">실행 {{ work.scheduled_date.slice(5).replace('-','.') }}</span><span v-if="deadline">{{ work?'· ':'' }}마감 {{ deadline.slice(5).replace('-','.') }}</span><span v-if="!work&&!deadline">일정 설정</span></button>
    <p v-if="item.content" class="project-work-note">{{ item.content }}</p>
    <span v-if="work?.status==='in_progress'&&!work.completed" class="status-chip">진행 중</span>
    <button v-if="work?.deleted_at" class="text-button" @click="emit('restore',work)">휴지통의 일정 복원</button>
    <div v-for="task in children" :key="task.id" class="linked-task"><button class="check-task" :class="{checked:task.completed}" :aria-label="task.title+' 완료 전환'" :aria-pressed="task.completed" :disabled="disabled" @click="emit('toggle',task)"><Check v-if="task.completed" :size="13" /></button><button :class="{struck:task.completed}" @click="emit('task',task)">{{ task.title }}<small v-if="task.scheduled_date!==work?.scheduled_date || task.deadline!==work?.deadline">실행 {{ task.scheduled_date.slice(5) }}<span v-if="task.deadline"> · 마감 {{ task.deadline.slice(5) }}</span></small></button></div>
    <button v-if="!work" class="item-add" @click="emit('task')"><Plus :size="14" />일정 등록</button>
  </article>
</template>
<style scoped>
.project-work-title{display:flex;gap:8px;align-items:flex-start}.project-work-title .check-task{width:17px;height:17px;min-width:17px;margin-top:3px;border-radius:5px}.project-work-title .board-title{line-height:1.8}.project-work-dates{display:flex;align-items:center;gap:6px;flex-wrap:wrap;text-align:left;font-size:13px;color:#809270;line-height:1.8;margin:13px 0}.project-work-note{font-size:14px;color:#8a987b;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin:15px 0}.project-work-card>.status-chip{display:inline-block;margin-top:4px}
</style>
