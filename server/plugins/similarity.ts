import { ensureDataStore } from '../db.ts'
import { prepareSimilarity, stopSimilarityPreparation } from '../similarity-preparation.ts'

export default defineNitroPlugin(nitro => {
  const initial = setTimeout(() => { void ensureDataStore().then(() => prepareSimilarity()).catch(() => {}) }, 1500)
  initial.unref()
  nitro.hooks.hook('afterResponse', event => {
    if (event.node.res.statusCode < 400 && ((event.method === 'POST' && (['/api/images', '/api/assets'].includes(event.path)
      || (event.path === '/share' && event.context.sharedImagesCreated === true)))
      || (event.method === 'PATCH' && event.path.endsWith('/visibility')))) prepareSimilarity()
  })
  nitro.hooks.hook('close', () => { clearTimeout(initial); stopSimilarityPreparation() })
})
