import { setHeader, setResponseStatus } from 'h3'
import { toAssetResponse } from '../db.ts'
import { readImageForm } from '../image-upload.ts'
import { saveImage } from '../image-storage.ts'
export default defineEventHandler(async (event) => {
  const form = await readImageForm(event, true)
  const result = await saveImage(form.input, form.source, form.hiddenFromGallery)
  setResponseStatus(event, result.created ? 201 : 200)
  setHeader(event, 'Location', `/api/assets/${result.row.id}`)
  setHeader(event, 'Cache-Control', 'no-store')
  return toAssetResponse(result.row)
})
