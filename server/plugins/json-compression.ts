import { compressLibraryJson } from '../json-compression.ts'
export default defineNitroPlugin(nitro => {
  nitro.hooks.hook('beforeResponse', compressLibraryJson)
})
