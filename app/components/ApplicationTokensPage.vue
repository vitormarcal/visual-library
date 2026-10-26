<script setup lang="ts">
type Token = { id: string; name: string; prefix: string; createdAt: string; revokedAt: string | null; publishPublicLinks: boolean }
const publishPublicLinks = ref(false)
const { $libraryApi } = useNuxtApp()
const tokens = ref<Token[]>([]), name = ref(''), secret = ref(''), busy = ref(false), error = ref(''), notice = ref('')
async function load() {
  try { tokens.value = await $libraryApi('/api/access/tokens') }
  catch { error.value = 'Could not load credentials. Try again.' }
}
async function create() {
  busy.value = true; secret.value = ''; error.value = ''; notice.value = ''
  try {
    const response = await $libraryApi<Token & { token: string }>('/api/access/tokens', { method: 'POST', body: { name: name.value, publishPublicLinks: publishPublicLinks.value } })
    const { token, ...entry } = response
    tokens.value = [entry, ...tokens.value]; secret.value = token; name.value = ''; publishPublicLinks.value = false
  } catch { error.value = 'Could not create the credential. Enter a name of up to 80 characters and try again.' }
  finally { busy.value = false }
}
async function revoke(entry: Token) {
  busy.value = true; error.value = ''; notice.value = ''; secret.value = ''
  try {
    await $libraryApi(`/api/access/tokens/${encodeURIComponent(entry.id)}`, { method: 'DELETE' })
    entry.revokedAt = new Date().toISOString(); notice.value = `Credential for ${entry.name} revoked.`
  } catch { error.value = 'Could not revoke the credential. Try again.' }
  finally { busy.value = false }
}
async function copy() {
  try { await navigator.clipboard.writeText(secret.value); notice.value = 'Credential copied.' }
  catch { notice.value = 'Select and copy the credential below.' }
}
onMounted(load)
useHead({ title: 'Access · Visual Library' })
</script>
<template>
  <main class="tokensPage">
    <header><a href="/?view=library">← Library</a><LibraryAccessControls settings /></header>
    <h1>Access</h1>
    <p>Create a separate credential for each application, such as Media Pulse. Credentials allow asset uploads, individual reads and reference tag updates.</p>
    <form @submit.prevent="create">
      <label for="application-name">Application name</label>
      <input id="application-name" v-model="name" required maxlength="80" placeholder="Media Pulse" :disabled="busy">
      <label class="publicationPermission"><input v-model="publishPublicLinks" type="checkbox" :disabled="busy"> Allow creating public image links</label>
      <p>Allows publishing any image by ID, including existing images. Public links remain available after revoking the credential.</p>
      <button type="submit" :disabled="busy || !name.trim()">Create credential</button>
    </form>
    <section v-if="secret" aria-label="New application credential" class="newCredential">
      <p>Copy now. This secret is shown only once. Keep it on the application server.</p>
      <input :value="secret" readonly aria-label="Application credential" autocomplete="off" @focus="($event.target as HTMLInputElement).select()">
      <button type="button" @click="copy">Copy credential</button>
    </section>
    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="error" type="button" :disabled="busy" @click="error = ''; load()">Reload credentials</button>
    <p v-if="notice" role="status">{{ notice }}</p>
    <ul aria-label="Application credentials">
      <li v-for="entry in tokens" :key="entry.id">
        <div><strong>{{ entry.name }}</strong><p>{{ entry.prefix }}… · {{ entry.revokedAt ? 'Revoked' : 'Active' }}{{ entry.publishPublicLinks ? ' · Public links allowed' : '' }}</p></div>
        <button v-if="!entry.revokedAt" type="button" :disabled="busy" :aria-label="`Revoke credential for ${entry.name}`" @click="revoke(entry)">Revoke</button>
      </li>
    </ul>
    <p v-if="!tokens.length && !error">No application credentials yet.</p>
  </main>
</template>
<style scoped>
.tokensPage { max-width: 720px; margin: 0 auto; padding: 24px; }
header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
a { color: var(--color-ink); }
h1 { font-size: 28px; margin-bottom: 16px; }
p { color: var(--color-mute); line-height: 1.5; font-size: 14px; }
form, .newCredential { display: grid; gap: 12px; margin: 24px 0; }
input { width: 100%; min-width: 0; border: 1px solid var(--color-hairline); border-radius: var(--radius-md); padding: 12px; }
.publicationPermission { display: flex; align-items: center; gap: 8px; }
.publicationPermission input { width: auto; }
button { justify-self: start; border: 0; border-radius: var(--radius-full); padding: 12px 16px; color: var(--color-ink); background: var(--color-surface-card); }
ul { list-style: none; padding: 0; }
li { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--color-hairline); }
li strong { overflow-wrap: anywhere; } li p { margin: 8px 0 0; }
[role=alert] { color: var(--color-error); }
</style>
