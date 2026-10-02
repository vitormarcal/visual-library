import { createError, readBody } from 'h3'
import { addTagsToImages, ensureDataStore } from '../../db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || !Array.isArray(body.imageIds) || !body.imageIds.length
    || body.imageIds.some((id: unknown) => typeof id !== 'string' || !id.trim())
    || !Array.isArray(body.tags) || !body.tags.length
    || body.tags.some((tag: unknown) => typeof tag !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid images or tags.' })
  }
  await ensureDataStore()
  try {
    return { images: addTagsToImages(body.imageIds, body.tags) }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (['Too many tags', 'Tag is too long', 'Select images and add tags', 'Image not found'].includes(message)) {
      throw createError({ statusCode: message === 'Image not found' ? 404 : 400, statusMessage: message })
    }
    throw error
  }
})
