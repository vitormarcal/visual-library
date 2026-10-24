import sharp from 'sharp'
import { mkdir, rename, unlink, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const [source, destination, expectedHash] = process.argv.slice(2)
const temporary = `${destination}.${randomUUID()}.tmp`
sharp.cache(false)
sharp.concurrency(1)
try {
  const bytes = await readFile(source)
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('Source changed')
  await mkdir(dirname(destination), { recursive: true })
  await sharp(bytes, { limitInputPixels: 40_000_000, animated: false })
    .rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 }).toFile(temporary)
  await rename(temporary, destination)
} catch {
  await unlink(temporary).catch(() => {})
  process.exitCode = 1
}
