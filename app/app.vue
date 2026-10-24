<script setup lang="ts">
const { $libraryApi, $invalidateLibraryAccess } = useNuxtApp()
const authenticated = useState<boolean>('library-authenticated', () => false)
const accessVersion = useState<number>('library-access-version', () => 0)
const password = ref(''), confirmation = ref(''), busy = ref(false), error = ref('')
const ready = ref(false)
const ownerState = ref<'ready' | 'setup' | 'blocked'>('blocked')
const generation = ref<string | null>(null)
const notice = ref('')
const accessPage = useRequestURL().searchParams.get('access') === '1'
const sharedWithoutSession = useRequestURL().searchParams.get('login') === 'share'
async function checkSession() {
  try {
    const state = await $libraryApi<{ authenticated: boolean; state: 'ready' | 'setup' | 'blocked'; generation: string | null }>('/api/auth/session')
    if (!state.authenticated && authenticated.value) $invalidateLibraryAccess()
    else authenticated.value = state.authenticated
    ownerState.value = state.state; generation.value = state.generation
    error.value = ''
  } catch { error.value = 'Could not check your session. Try again.' }
  finally { ready.value = true }
}
await checkSession()
useHead({ title: 'Visual Library' })
async function login() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    if (ownerState.value === 'setup') {
      await $libraryApi('/api/auth/setup', { method: 'POST', body: { password: password.value, confirmation: confirmation.value, generation: generation.value } })
      password.value = ''; confirmation.value = ''
      await checkSession()
      notice.value = 'Password saved. Sign in to open your library.'
      return
    }
    await $libraryApi('/api/auth/login', { method: 'POST', body: { password: password.value } })
    password.value = ''; confirmation.value = ''; notice.value = ''
    accessVersion.value++
    authenticated.value = true
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode
    if (status === 409) { await checkSession(); notice.value = 'Password setup changed or was completed. Sign in or reload.'; return }
    error.value = status === 400 ? 'Use matching passwords of 12–1024 characters.' : status === 401 ? 'Incorrect password.' : status === 429 ? 'Too many attempts. Try again in a minute.' : 'Could not sign in. Try again.'
  } finally { busy.value = false }
}
let poll: ReturnType<typeof setInterval> | undefined
const checkVisibleSession = () => { if (document.visibilityState === 'visible' && authenticated.value) void checkSession() }
onMounted(() => { poll = setInterval(checkVisibleSession, 60_000); window.addEventListener('focus', checkVisibleSession); document.addEventListener('visibilitychange', checkVisibleSession) })
onBeforeUnmount(() => { if (poll) clearInterval(poll); window.removeEventListener('focus', checkVisibleSession); document.removeEventListener('visibilitychange', checkVisibleSession) })
</script>

<template>
  <ApplicationTokensPage v-if="ready && authenticated && accessPage" :key="accessVersion" />
  <LibraryApp v-else-if="ready && authenticated" :key="accessVersion" />
  <main v-else class="accessPage">
    <form class="accessCard" @submit.prevent="login">
      <p>Visual Library</p>
      <h1>{{ ownerState === 'setup' ? 'Set your owner password' : 'Your visual library' }}</h1>
      <p v-if="ownerState === 'blocked'">Owner access is not configured. Set OWNER_RESET_KEY to a new UUID on the server and restart.</p>
      <p v-else>{{ ownerState === 'setup' ? 'Choose a password to protect your personal library.' : 'Sign in to browse and save your references.' }}</p>
      <p v-if="sharedWithoutSession" role="status">Sign in, then share the image again from the other app.</p>
      <template v-if="ownerState !== 'blocked'">
        <label for="owner-password">{{ ownerState === 'setup' ? 'New password' : 'Password' }}</label>
        <input id="owner-password" v-model="password" type="password" :autocomplete="ownerState === 'setup' ? 'new-password' : 'current-password'" required :minlength="ownerState === 'setup' ? 12 : undefined" maxlength="1024" :disabled="busy">
        <template v-if="ownerState === 'setup'">
          <label for="confirm-password">Confirm password</label>
          <input id="confirm-password" v-model="confirmation" type="password" autocomplete="new-password" required minlength="12" maxlength="1024" :disabled="busy">
          <p>Use at least 12 characters.</p>
        </template>
      </template>
      <p v-if="notice" role="status">{{ notice }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <button v-if="ownerState !== 'blocked'" type="submit" :disabled="busy || !ready">{{ busy ? 'Please wait…' : ownerState === 'setup' ? 'Save password' : 'Sign in' }}</button>
    </form>
  </main>
</template>

<style scoped>
.accessPage { min-height: 100dvh; display: grid; place-items: center; padding: 24px; background: var(--color-surface-soft); }
.accessCard { width: min(100%, 400px); display: grid; gap: 16px; padding: 32px; border-radius: var(--radius-lg); background: var(--color-canvas); }
h1, p { margin: 0; }
p { color: var(--color-mute); line-height: 1.5; }
h1 { font-size: 28px; letter-spacing: -.8px; }
input, button { min-height: 44px; border-radius: var(--radius-md); padding: 10px 14px; }
input { width: 100%; border: 1px solid var(--color-hairline); }
button { border: 0; background: var(--color-primary); color: white; font-weight: 600; }
button:disabled { opacity: .6; }
[role=alert] { color: var(--color-error); }
</style>
