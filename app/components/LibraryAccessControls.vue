<script setup lang="ts">
defineProps<{ settings?: boolean }>()
const { $libraryApi, $invalidateLibraryAccess } = useNuxtApp()
const busy = ref(false), error = ref('')
async function logout() {
  busy.value = true; error.value = ''
  try { await $libraryApi('/api/auth/logout', { method: 'POST' }); $invalidateLibraryAccess() }
  catch { error.value = 'Could not sign out. Try again.' }
  finally { busy.value = false }
}
</script>
<template>
  <div class="accessControls">
    <a v-if="!settings" href="/?access=1">Access</a>
    <button type="button" :disabled="busy" @click="logout">Sign out</button>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.accessControls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
button, a { border: 0; border-radius: var(--radius-full); padding: 10px 14px; background: var(--color-surface-card); color: var(--color-ink); text-decoration: none; font-size: 14px; }
[role=alert] { color: var(--color-error); }
</style>
