import { createError, readBody } from 'h3'
import { ensureDataStore, maxTagsPerImage, maxTagLength, replaceImageTags } from '../../../db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing image id.',
    })
  }

  const db = await ensureDataStore()
  const image = db.prepare('SELECT id FROM images WHERE id = ?').get(id) as { id: string } | undefined

  if (!image) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Image not found.',
    })
  }

  const body = await readBody<{ tags?: unknown }>(event)

  if (!Array.isArray(body.tags) || body.tags.some((tag) => typeof tag !== 'string')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid tags.',
    })
  }

  try {
    return {
      tags: replaceImageTags(id, body.tags),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid tags.'

    if (message === 'Too many tags') {
      throw createError({
        statusCode: 400,
        statusMessage: `Too many tags. Maximum is ${maxTagsPerImage}.`,
      })
    }

    if (message === 'Tag is too long') {
      throw createError({
        statusCode: 400,
        statusMessage: `Tag is too long. Maximum is ${maxTagLength} characters.`,
      })
    }

    throw error
  }
})
