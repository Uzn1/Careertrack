<script setup lang="ts">
import { ref } from 'vue'
import { GripVertical } from 'lucide-vue-next'
import { taskStatus, type Task, type TaskStatus } from '../../shared/domain'
const props = defineProps<{ tasks: Task[]; contexts: Record<string,string>; disabled?: boolean }>()
const emit = defineEmits<{ edit:[task:Task]; toggle:[task:Task]; postpone:[task:Task]; project:[task:Task]; remove:[task:Task]; status:[task:Task,status:TaskStatus] }>()
const columns: {id:TaskStatus;label:string;hint:string}[] = [{id:'todo',label:'할 일',hint:'시작할 일을 모아두세요.'},{id:'in_progress',label:'진행 중',hint:'지금 집중하고 있는 일이에요.'},{id:'done',label:'완료',hint:'오늘 이룬 작은 성취예요.'}]
const dragging = ref(''), over = ref<TaskStatus|null>(null)
function start(event:DragEvent, task:Task) {
 if(props.disabled){event.preventDefault();return}
 dragging.value=task.id
 if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',task.id)}
}
function drop(event:DragEvent, status:TaskStatus) {
 const id=event.dataTransfer?.getData('text/plain')
 const task=props.tasks.find(task=>task.id===id && task.id===dragging.value)
 if(task&&!props.disabled&&taskStatus(task)!==status)emit('status',task,status)
 dragging.value='';over.value=null
}
</script>
<template>
  <div class="task-board" aria-label="오늘 할 일 상태 보드">
    <section v-for="column in columns" :key="column.id" class="task-board-column" :class="[column.id,{dropzone:over===column.id}]" :aria-label="column.label+' 열'" @dragover.prevent="over=column.id" @dragleave.self="over=null" @drop.prevent="drop($event,column.id)">
      <div class="task-board-heading"><h3><span class="board-status-mark"></span>{{ column.label }}</h3><span>{{ tasks.filter(task=>taskStatus(task)===column.id).length }}</span></div><p class="task-board-hint">{{ column.hint }}</p>
      <div v-for="task in tasks.filter(task=>taskStatus(task)===column.id)" :key="task.id" class="draggable-task" :class="{dragging:dragging===task.id}" :draggable="!disabled" @dragstart="start($event,task)" @dragend="dragging='';over=null"><div class="drag-handle" aria-hidden="true"><GripVertical :size="14" /></div><TaskCard :task="task" :context="contexts[task.id]" :disabled="disabled" :show-scheduling="true" @edit="emit('edit',task)" @toggle="emit('toggle',task)" @postpone="emit('postpone',task)" @project="emit('project',task)" @remove="emit('remove',task)" /></div>
      <div v-if="!tasks.some(task=>taskStatus(task)===column.id)" class="board-drop-hint">{{ column.id==='done'?'완료한 일이 여기에 모여요.':'카드를 이곳으로 옮겨보세요.' }}</div>
    </section>
  </div>
</template>
