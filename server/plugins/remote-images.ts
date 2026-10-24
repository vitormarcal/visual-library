import { remoteImageDispatcher } from '../image-url.ts'
export default defineNitroPlugin(nitro => {
  nitro.hooks.hook('close', async () => { await remoteImageDispatcher.destroy() })
})
