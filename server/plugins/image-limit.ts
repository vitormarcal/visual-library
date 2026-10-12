import { parseImageSizeLimit } from '../image-upload.ts'
export default defineNitroPlugin(() => { parseImageSizeLimit(useRuntimeConfig().public.maxImageSizeBytes) })
