<script setup lang="ts">
defineProps<{ label: string }>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
const id = useId()
const close = (restore = false) => { open.value = false; if (restore) trigger.value?.focus({ preventScroll: true }) }
const toggle = async () => {
  if (open.value) { close(); return }
  open.value = true
  await nextTick()
  const bounds = trigger.value?.getBoundingClientRect()
  if (bounds && panel.value) {
    const height = panel.value.offsetHeight
    panel.value.style.top = `${Math.max(8, Math.min(bounds.bottom + 8, window.innerHeight - height - 8))}px`
    panel.value.style.left = `${Math.max(8, Math.min(bounds.right - panel.value.offsetWidth, window.innerWidth - panel.value.offsetWidth - 8))}px`
  }
  panel.value?.querySelector<HTMLElement>('button:not(:disabled), a[href]')?.focus()
}
const outside = (event: Event) => { if (!(event.target instanceof Node) || !root.value?.contains(event.target)) close() }
const leave = () => { requestAnimationFrame(() => { if (!root.value?.contains(document.activeElement)) close() }) }
const keydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) { event.preventDefault(); event.stopPropagation(); close(true) }
}
onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('resize', outside); window.addEventListener('scroll', outside, true) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', outside); window.removeEventListener('scroll', outside, true) })
</script>
<template>
  <span ref="root" class="libraryMenu" @keydown="keydown" @focusout="leave">
    <button ref="trigger" type="button" class="libraryMenuTrigger" :aria-label="label" :aria-expanded="open" :aria-controls="id" @click="toggle"><slot name="trigger">•••</slot></button>
    <span v-if="open" :id="id" ref="panel" class="libraryMenuPanel" @click="close(true)"><slot /></span>
  </span>
</template>
<style>
.libraryMenu { display: inline-flex; flex-shrink: 0; }
.libraryMenuTrigger { display: inline-grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: var(--radius-full); background: var(--color-canvas); color: var(--color-ink); cursor: pointer; }
.libraryMenuTrigger:hover { background: var(--color-surface-card); }
.libraryMenuPanel { position: fixed; top: 144px; right: 24px; z-index: 50; width: min(260px, calc(100vw - 16px)); max-height: calc(100dvh - 16px); overflow: auto; display: grid; padding: 8px; border: 1px solid var(--color-hairline); border-radius: var(--radius-md); background: var(--color-canvas); box-shadow: 0 8px 24px #00000014; }
.libraryMenuPanel > button, .libraryMenuPanel > a { display: flex; align-items: center; min-height: 44px; width: 100%; padding: 10px 14px; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-ink); font-size: 14px; font-weight: 600; text-decoration: none; text-align: left; }
.libraryMenuPanel > button:hover, .libraryMenuPanel > a:hover { background: var(--color-surface-card); }
</style>
