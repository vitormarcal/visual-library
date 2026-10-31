import { parse } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'
import { createError } from 'h3'
import { parseRemoteUrl } from './image-url.ts'
type Node = DefaultTreeAdapterMap['node']
export type PageCandidate = { id: string; url: string; width: number | null; height: number | null }
const attrs = (node: Node): Record<string, string> => Object.fromEntries('attrs' in node ? node.attrs.map(a => [a.name, a.value]) : [])
const children = (node: Node): Node[] => 'childNodes' in node ? node.childNodes : []
const tag = (node: Node) => 'tagName' in node ? node.tagName : ''
function* walk(root: Node, excludeChrome = false): Generator<Node> {
  const pending = [root]
  let count = 0
  while (pending.length) {
    const node = pending.pop()!
    if (++count > 100_000) throw createError({ statusCode: 422, statusMessage: 'This page is too complex to read.' })
    if (excludeChrome && ['header', 'nav', 'aside', 'footer', 'script', 'style'].includes(tag(node))) continue
    yield node
    const list = children(node)
    for (let i = list.length - 1; i >= 0; i--) pending.push(list[i]!)
  }
}
export function discoverPageImages(html: string, pageUrl: string) {
  const doc = parse(html, { scriptingEnabled: false }), nodes = [...walk(doc)]
  let base = pageUrl
  const resolve = (value: string) => {
    if (!value.trim()) return null
    try { const u = parseRemoteUrl(new URL(value, base).href); u.hash = ''; return u.href } catch { return null }
  }
  const declaredBase = nodes.find(n => tag(n) === 'base')
  if (declaredBase) base = resolve(attrs(declaredBase).href ?? '') ?? pageUrl
  const content = nodes.find(n => /(?:^|\s)(entry-content|post-content|elementor-widget-theme-post-content)(?:\s|$)/.test(attrs(n).class ?? ''))
    ?? nodes.find(n => tag(n) === 'article') ?? nodes.find(n => tag(n) === 'main')
  const root = content ?? nodes.find(n => tag(n) === 'body') ?? doc
  const candidates: PageCandidate[] = [], aliases = new Map<string, PageCandidate>()
  for (const node of walk(root, true)) {
    if (tag(node) !== 'img') continue
    const a = attrs(node), width = Number(a.width) > 0 ? Number(a.width) : null, height = Number(a.height) > 0 ? Number(a.height) : null
    if (width && height && width <= 48 && height <= 48) continue
    const original = resolve(a['data-lazy-src'] || a['data-src'] || a.src || '')
    const parent = 'parentNode' in node ? node.parentNode : null
    // Only unconditional picture sources are comparable to the fallback image.
    const source = parent && tag(parent) === 'picture' ? children(parent).find(n => {
      const s = attrs(n)
      return tag(n) === 'source' && !s.media && (!s.type || ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(s.type))
    }) : undefined
    const sourceAttrs = source ? attrs(source) : {}
    const set = sourceAttrs.srcset || a['data-lazy-srcset'] || a['data-srcset'] || a.srcset || ''
    const variants = set.split(',').flatMap(part => {
      const m = part.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)(w|x)$/)
      const url = m && resolve(m[1]!)
      return m && url ? [{ url, size: Number(m[2]), unit: m[3] }] : []
    })
    const unit = variants[0]?.unit
    const best = variants.filter(v => v.unit === unit).sort((a,b) => b.size-a.size)[0]
    let url = best?.url ?? original
    if (original && best?.unit === 'w' && width && width > best.size && !source) url = original
    const linked = parent && tag(parent) === 'a' ? resolve(attrs(parent).href ?? '') : null
    if (linked && /\.(?:jpe?g|png|webp|gif|avif)$/i.test(new URL(linked).pathname)) url = linked
    if (!url) continue
    const representations = [original, ...variants.map(v => v.url), url].filter((v): v is string => !!v)
    const existing = representations.map(u => aliases.get(u)).find(Boolean)
    if (existing) { for (const u of representations) aliases.set(u, existing); continue }
    if (candidates.length >= 200) throw createError({ statusCode: 422, statusMessage: 'This page has too many images. Choose a smaller post.' })
    const candidate = { id: String(candidates.length), url, width, height }
    candidates.push(candidate)
    for (const u of representations) aliases.set(u, candidate)
  }
  return { pageUrl, candidates, fallback: !content }
}
