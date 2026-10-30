import { duplicatesEnabled, prepareDuplicates, stopDuplicatePreparation } from '../duplicate-preparation.ts'
export default defineNitroPlugin(nitro => {
  const initial = setTimeout(() => { if (duplicatesEnabled()) void prepareDuplicates() }, 1500)
  initial.unref()
  nitro.hooks.hook('afterResponse', event => {
    if (!duplicatesEnabled() || event.node.res.statusCode >= 400) return
    const path = event.path.split('?')[0]
    if ((event.method === 'POST' && (['/api/images', '/api/assets'].includes(path!) || path === '/share' && event.context.sharedImagesCreated === true))
      || event.method === 'PATCH' && path?.endsWith('/visibility')) void prepareDuplicates()
  })
  nitro.hooks.hook('close', () => { clearTimeout(initial); stopDuplicatePreparation() })
})
