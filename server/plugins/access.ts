import { accessConfig } from '../auth.ts'
import { initializeOwnerAccess } from '../access-store.ts'
export default defineNitroPlugin(nitro => {
  // Nitro invokes plugins synchronously: invalid configuration must throw here.
  const config = accessConfig()
  const ready = initializeOwnerAccess(config)
  // Keep the rejected promise handled until the first request awaits it.
  ready.catch(() => {})
  nitro.hooks.hook('request', async () => { await ready })
})
