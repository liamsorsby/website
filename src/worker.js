import { posts, about, cv, version } from './posts.generated.js'
import { site } from './site.js'
import { layout, postList, postPage, tagsPage, rss, sitemap, esc } from './templates.js'

const tags = [...new Set(posts.flatMap((p) => p.tags))].sort()

// Everything is cached for 10 minutes, in the browser and at the edge.
const TTL = 600
const CACHE = `public, max-age=${TTL}, s-maxage=${TTL}`

const html = (body, status = 200) => ({ body, status, type: 'text/html; charset=utf-8' })

function route(path) {
  path = path.length > 1 ? path.replace(/\/+$/, '') : path
  if (path === '/') {
    return html(layout({ title: site.title, body: `<h1>Latest posts</h1>${postList(posts)}` }))
  }
  if (path === '/blog') return { redirect: '/' }
  if (path === '/about') {
    return html(layout({ title: about.title, path, body: `<h1>${esc(about.title)}</h1>${about.html}` }))
  }
  if (path === '/cv') {
    return html(layout({ title: cv.title, path, description: `CV of ${site.author}`, body: `<h1>${esc(cv.title)}</h1>${cv.html}` }))
  }
  if (path === '/tags') return html(tagsPage(posts))
  if (path.startsWith('/tags/')) {
    const tag = decodeURIComponent(path.slice(6))
    const list = posts.filter((p) => p.tags.includes(tag))
    if (list.length) {
      return html(layout({ title: `#${tag}`, path, body: `<h1>#${esc(tag)}</h1>${postList(list)}` }))
    }
  }
  if (path.startsWith('/blog/')) {
    const post = posts.find((p) => p.slug === decodeURIComponent(path.slice(6)))
    if (post) return html(postPage(post))
  }
  if (path === '/feed.xml') return { body: rss(posts), status: 200, type: 'application/rss+xml; charset=utf-8' }
  if (path === '/sitemap.xml') {
    return { body: sitemap(posts, tags), status: 200, type: 'application/xml; charset=utf-8' }
  }
  if (path === '/robots.txt') {
    return { body: `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`, status: 200, type: 'text/plain' }
  }
  return html(
    layout({ title: 'Not found', body: '<h1>404</h1><p>That page does not exist. <a href="/">Back to the blog</a>.</p>' }),
    404
  )
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
    }
    const url = new URL(request.url)
    const cache = caches.default
    const key = new Request(`${url.origin}${url.pathname}?v=${version}`, { method: 'GET' })

    const hit = await cache.match(key)
    if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit

    const r = route(url.pathname)
    if (r.redirect) {
      return new Response(null, { status: 301, headers: { Location: url.origin + r.redirect, 'Cache-Control': CACHE } })
    }

    const response = new Response(r.body, {
      status: r.status,
      headers: {
        'Content-Type': r.type,
        'Cache-Control': CACHE,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    })
    ctx.waitUntil(cache.put(key, response.clone()))
    return request.method === 'HEAD' ? new Response(null, response) : response
  },
}
