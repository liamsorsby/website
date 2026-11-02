import { site } from './site.js'

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

const css = `
:root{color-scheme:light dark;--fg:#1f2937;--bg:#fff;--muted:#6b7280;--link:#0369a1;--code:#f3f4f6;--line:#e5e7eb}
@media(prefers-color-scheme:dark){:root{--fg:#e5e7eb;--bg:#111827;--muted:#9ca3af;--link:#38bdf8;--code:#1f2937;--line:#374151}}
body{margin:0;background:var(--bg);color:var(--fg);font:18px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--link)}main,header,footer{max-width:46rem;margin:0 auto;padding:1rem 1.25rem}
header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;border-bottom:1px solid var(--line)}
header a{text-decoration:none;font-weight:600;margin-left:1rem}header a:first-child{margin:0;font-size:1.2rem;color:var(--fg)}
footer{color:var(--muted);font-size:.9rem;border-top:1px solid var(--line);margin-top:3rem}
h1{line-height:1.2}.meta,.tag{color:var(--muted);font-size:.9rem}.tag{margin-right:.5rem}
.post{margin:2rem 0}.post h2{margin:0}.post h2 a{text-decoration:none}
pre{background:var(--code);padding:1rem;overflow:auto;border-radius:.5rem;font-size:.85rem;line-height:1.5}
code{background:var(--code);padding:.1em .3em;border-radius:.25rem;font-size:.9em}pre code{background:none;padding:0}
img{max-width:100%}table{border-collapse:collapse;display:block;overflow:auto}td,th{border:1px solid var(--line);padding:.3rem .6rem}
blockquote{border-left:4px solid var(--line);margin-left:0;padding-left:1rem;color:var(--muted)}
.hljs-comment,.hljs-quote{color:#6b7280}.hljs-keyword,.hljs-selector-tag,.hljs-literal{color:#c026d3}
.hljs-string,.hljs-regexp,.hljs-addition{color:#059669}.hljs-number,.hljs-built_in,.hljs-attr{color:#d97706}
.hljs-title,.hljs-section,.hljs-name{color:#2563eb}.hljs-deletion{color:#dc2626}`

export function layout({ title, description = site.description, path = '/', body, type = 'website' }) {
  const full = title === site.title ? title : `${title} | ${site.author}`
  const ga = site.gaId
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${site.gaId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${site.gaId}')</script>`
    : ''
  return `<!doctype html><html lang="${site.language}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${site.url}${path}"><link rel="icon" href="/static/favicons/favicon.ico">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/feed.xml">
<meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${type}"><meta property="og:url" content="${site.url}${path}">
<meta property="og:image" content="${site.url}/static/images/twitter-card.png">
<style>${css}</style>${ga}</head><body>
<header><a href="/">${esc(site.author)}</a><nav><a href="/">Blog</a><a href="/tags">Tags</a><a href="/about">About</a><a href="/cv">CV</a><a href="https://debug-toolkit.sorsby.co/">Debug Toolkit</a></nav></header>
<main>${body}</main>
<footer>© ${new Date().getUTCFullYear()} ${esc(site.author)} · ${Object.entries(site.social)
    .map(([n, u]) => `<a href="${u}" rel="me noopener">${n}</a>`)
    .join(' · ')}</footer></body></html>`
}

const tagLinks = (tags) =>
  tags.map((t) => `<a class="tag" href="/tags/${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')

export const postList = (posts) =>
  posts
    .map(
      (p) => `<article class="post"><h2><a href="/blog/${p.slug}">${esc(p.title)}</a></h2>
<div class="meta"><time datetime="${p.date}">${fmt(p.date)}</time></div><p>${esc(p.summary)}</p>${tagLinks(p.tags)}</article>`
    )
    .join('') || '<p>No posts yet.</p>'

export const postPage = (p) =>
  layout({
    title: p.title,
    description: p.summary,
    path: `/blog/${p.slug}`,
    type: 'article',
    body: `<article><h1>${esc(p.title)}</h1><div class="meta"><time datetime="${p.date}">${fmt(p.date)}</time>${
      p.updated ? ` · updated ${fmt(p.updated)}` : ''
    }</div><div>${tagLinks(p.tags)}</div>${p.html}</article>`,
  })

export const tagsPage = (posts) => {
  const counts = {}
  for (const p of posts) for (const t of p.tags) counts[t] = (counts[t] || 0) + 1
  const items = Object.keys(counts)
    .sort()
    .map((t) => `<li><a href="/tags/${encodeURIComponent(t)}">#${esc(t)}</a> (${counts[t]})</li>`)
    .join('')
  return layout({ title: 'Tags', path: '/tags', body: `<h1>Tags</h1><ul>${items}</ul>` })
}

export const rss = (posts) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(site.title)}</title>
<link>${site.url}</link><description>${esc(site.description)}</description><language>${site.language}</language>
<atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>
${posts
  .map(
    (p) => `<item><title>${esc(p.title)}</title><link>${site.url}/blog/${p.slug}</link><guid>${site.url}/blog/${p.slug}</guid>
<pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.summary)}</description></item>`
  )
  .join('\n')}
</channel></rss>`

export const sitemap = (posts, tags) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
    '/',
    '/tags',
    '/about',
    '/cv',
    ...tags.map((t) => `/tags/${encodeURIComponent(t)}`),
  ]
    .map((u) => `<url><loc>${site.url}${u}</loc></url>`)
    .join('')}${posts
    .map((p) => `<url><loc>${site.url}/blog/${p.slug}</loc><lastmod>${p.updated || p.date}</lastmod></url>`)
    .join('')}</urlset>`
