<script setup lang="ts">
defineProps<{ name: 'library' | 'explore' | 'add' | 'settings' | 'search' | 'filter' }>()
</script>
<template>
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="name === 'library'"><rect x="3" y="3" width="7" height="18" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></template>
    <template v-else-if="name === 'explore'"><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></template>
    <path v-else-if="name === 'add'" d="M12 5v14M5 12h14" />
    <template v-else-if="name === 'search'"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></template>
    <template v-else><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--color-canvas)" /><circle cx="16" cy="17" r="3" fill="var(--color-canvas)" /></template>
  </svg>
</template>
