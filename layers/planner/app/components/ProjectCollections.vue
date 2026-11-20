<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue'
import {LayoutGrid,List,GripVertical,ArrowUp,ArrowDown} from 'lucide-vue-next'
import {orderedProjects,type Project,type ProjectItem,type ProjectMaterial} from '../../shared/domain'
const props=defineProps<{projects:Project[];items:ProjectItem[];materials:ProjectMaterial[];busy:boolean}>()
const emit=defineEmits<{open:[id:string];move:[project:Project,beforeId:string|null,archive:boolean]}>()
const layout=ref<'gallery'|'list'>('gallery'),dragging=ref(''),over=ref('')
const collections=computed(()=>[false,true].map(archive=>({archive,label:archive?'종료된 프로젝트':'진행 중인 프로젝트',projects:orderedProjects(props.projects.filter(project=>Boolean(project.archived_at)===archive))})))
onMounted(()=>{try{if(localStorage.getItem('careertrack-project-layout')==='list')layout.value='list'}catch{/* Keep the default when browser preferences are unavailable. */}})
watch(layout,value=>{try{localStorage.setItem('careertrack-project-layout',value)}catch{/* Layout changes still work without persistence. */}})
function start(event:DragEvent,project:Project){
 if(props.busy){event.preventDefault();return}
 dragging.value=project.id
 if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',project.id)}
}
function drop(event:DragEvent,archive:boolean,before:string|null){
 const id=event.dataTransfer?.getData('text/plain')
 const project=props.projects.find(project=>project.id===id&&project.id===dragging.value)
 if(project&&!props.busy&&project.id!==before)emit('move',project,before,archive)
 dragging.value='';over.value=''
}
</script>
<template>
  <div class="project-collections">
    <div class="project-view-toolbar"><p>드래그로 순서를 바꾸거나 진행·종료 영역 사이로 이동하세요.</p><div class="project-view-options" role="group" aria-label="프로젝트 보기 방식"><button :aria-pressed="layout==='gallery'" @click="layout='gallery'"><LayoutGrid :size="16" />갤러리</button><button :aria-pressed="layout==='list'" @click="layout='list'"><List :size="17" />리스트</button></div></div>
    <section v-for="collection in collections" :key="String(collection.archive)" class="project-collection" :class="{dropzone:over===collection.label}" :aria-label="collection.label" @dragover.prevent="dragging&&(over=collection.label)" @drop.prevent="drop($event,collection.archive,null)">
      <div class="project-collection-heading"><h2>{{ collection.label }}</h2><span class="count-pill">{{ collection.projects.length }}</span></div>
      <div v-if="collection.projects.length" class="project-gallery" :class="{'project-list':layout==='list'}">
        <article v-for="(project,index) in collection.projects" :key="project.id" class="project-entry" :class="{'project-gallery-card':layout==='gallery','project-list-row':layout==='list',dragging:dragging===project.id,'insert-before':over===project.id}" :draggable="!busy" @dragstart="start($event,project)" @dragend="dragging='';over=''" @dragover.prevent.stop="dragging&&(over=project.id)" @drop.prevent.stop="drop($event,collection.archive,project.id)">
          <GripVertical class="project-drag-handle" :size="17" aria-hidden="true" />
          <button class="project-card-main" @click="emit('open',project.id)"><span class="company-logo" :class="`square-${index%3}`">{{ (project.company||project.title).slice(0,1) }}</span><span class="project-card-copy"><span class="project-company">{{ project.company||'지원 프로젝트' }}</span><h3>{{ project.title }}</h3><span class="project-period">{{ project.start_date||'시작일 미정' }} ~ {{ project.deadline||'마감일 미정' }}</span><span class="project-counts">일정 {{ items.filter(item=>item.project_id===project.id).length }}개 · 자료 {{ materials.filter(material=>material.project_id===project.id).length }}개</span></span></button>
          <div class="project-card-controls"><label><span class="sr-only">{{ project.title }} 보관 상태</span><select :value="collection.archive?'ended':'active'" :disabled="busy" @change="emit('move',project,null,($event.target as HTMLSelectElement).value==='ended')"><option value="active">진행 중</option><option value="ended">종료됨</option></select></label><div><button class="icon-button" :aria-label="project.title+' 앞 순서로 이동'" :disabled="busy||index===0" @click="emit('move',project,collection.projects[index-1]!.id,collection.archive)"><ArrowUp :size="15" /></button><button class="icon-button" :aria-label="project.title+' 뒤 순서로 이동'" :disabled="busy||index===collection.projects.length-1" @click="emit('move',project,collection.projects[index+2]?.id||null,collection.archive)"><ArrowDown :size="15" /></button></div></div>
        </article>
      </div>
      <p v-else class="collection-empty">{{ collection.archive?'종료한 프로젝트를 이곳으로 옮겨 보관하세요.':'새 프로젝트를 만들거나 종료된 프로젝트를 이곳으로 옮겨보세요.' }}</p>
    </section>
  </div>
</template>
<style scoped>
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.project-view-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 26px}.project-view-toolbar p{font-size:13px;color:var(--muted);line-height:1.7}.project-view-options{display:flex;gap:3px;border:1px solid var(--line);border-radius:999px;padding:4px;background:#fff;flex-shrink:0}.project-view-options button{display:flex;gap:6px;align-items:center;padding:8px 13px;font-size:12px;border-radius:999px;color:var(--muted)}.project-view-options button[aria-pressed=true]{color:#fff;background:#242429}.project-collection{border:2px solid transparent;padding:10px;border-radius:22px}.project-collection.dropzone{border-color:var(--brand);background:var(--mint)}.project-entry{position:relative;display:flex;flex-direction:column;gap:22px;min-width:0;cursor:grab}.project-entry.dragging{opacity:.4}.project-entry.insert-before{outline:2px dashed var(--brand);outline-offset:3px}.project-drag-handle{position:absolute;right:13px;top:15px;color:#9d94aa}.project-card-main{display:flex;flex-direction:column;gap:16px;align-items:flex-start;text-align:left;min-width:0;width:100%;padding:0}.project-card-copy{display:flex;flex-direction:column;gap:10px;min-width:0}.project-card-copy h3{font-size:22px;line-height:1.5;overflow-wrap:anywhere}.project-company,.project-period,.project-counts{font-size:13px;line-height:1.7;color:var(--muted)}.project-counts{font-size:12px}.project-card-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #e0dbea;padding-top:14px;margin-top:auto}.project-card-controls select{font-size:12px;border:1px solid #e0dbea;border-radius:999px;background:#ffffff80;padding:6px 10px;max-width:100%;color:#65596e}.project-card-controls>div{display:flex;gap:3px}.project-gallery.project-list{grid-template-columns:1fr}.project-gallery.project-list{gap:0;border-top:1px solid var(--line)}.project-list-row{flex-direction:row;align-items:center;gap:20px;padding:18px 0;border-bottom:1px solid var(--line)}.project-list .project-card-main{display:grid;grid-template-columns:36px minmax(0,1fr);gap:14px;align-items:center;flex:1;width:auto}.project-list .company-logo{width:36px;height:36px;margin:0}.project-list .project-card-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:20px;align-items:center}.project-list .project-company{grid-column:1;margin:0}.project-list .project-card-copy h3{grid-column:1;grid-row:2}.project-list .project-period{grid-column:2;grid-row:1}.project-list .project-counts{grid-column:2;grid-row:2}.project-list .project-card-copy h3{font-size:18px}.project-list .project-card-copy{gap:4px}.project-list .project-card-controls{margin:0;border:0;padding:0;flex-shrink:0}.project-list .project-drag-handle{display:none}
@media(max-width:767px){.project-view-toolbar{align-items:flex-start;flex-direction:column}.project-view-options{align-self:flex-end}.project-collection{padding:0}.project-card-copy h3{font-size:20px}.project-list-row{flex-wrap:wrap;padding:16px 0;gap:12px}.project-list .project-card-copy{display:flex}.project-list .project-card-main{flex-basis:100%}.project-list .project-card-copy h3{font-size:16px}.project-list .project-card-controls{width:100%;padding-left:50px}.project-card-controls select{font-size:14px}}
</style>
