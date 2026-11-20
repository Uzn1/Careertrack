<script setup lang="ts">
defineEmits<{home: []}>()
</script>
<template>
  <a href="/?view=home" class="brand career-brand" aria-label="CareerTrack 홈" @click.prevent="$emit('home')">
    <span class="career-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M11 29V18a7 7 0 0 1 7-7h11" stroke="currentColor" stroke-width="3.3" stroke-linecap="round" /><path d="M18 29v-8a3 3 0 0 1 3-3h8" stroke="currentColor" stroke-width="3.3" stroke-linecap="round" opacity=".65" /><circle cx="29" cy="11" r="2.4" fill="currentColor" /><circle cx="29" cy="18" r="2" fill="currentColor" opacity=".65" /></svg></span><span class="career-wordmark">Career<span>Track</span><i></i></span>
  </a>
</template>
<style scoped>
.career-brand{display:inline-flex;align-items:center;gap:9px;padding:0 6px;letter-spacing:-.7px;white-space:nowrap}.career-mark{width:35px;height:35px;border-radius:11px;display:grid;place-items:center;background:var(--brand);color:white;box-shadow:0 3px 7px #284a2315;flex-shrink:0}.career-mark svg{width:35px;height:35px}.career-wordmark{font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:750;color:var(--ink);letter-spacing:-.9px;display:flex;align-items:baseline}.career-wordmark>span{font-weight:500;color:var(--green)}.career-wordmark i{width:4px;height:4px;border-radius:50%;background:var(--brand);margin-left:3px}
</style>
