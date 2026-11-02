import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import { load } from 'js-yaml'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import hljs from 'highlight.js'

const root = new URL('..', import.meta.url).pathname
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : []
  })

const render = (src) =>
  new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight: (code, lang) =>
        hljs.highlight(code, { language: hljs.getLanguage(lang) ? lang : 'plaintext' }).value,
    }),
    gfmHeadingId()
  ).parse(src)

const matter = (text) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  return m ? { data: load(m[1]) ?? {}, content: m[2] } : { data: {}, content: text }
}

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d))

const posts = walk(join(root, 'content/posts'))
  .map((file) => {
    const { data, content } = matter(readFileSync(file, 'utf8'))
    return {
      slug: relative(join(root, 'content/posts'), file).replace(/\.md$/, ''),
      title: data.title,
      date: iso(data.date),
      updated: data.lastmod ? iso(data.lastmod) : undefined,
      tags: data.tags ?? [],
      summary: data.summary ?? '',
      draft: !!data.draft,
      html: render(content),
    }
  })
  .filter((p) => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date))

const about = matter(readFileSync(join(root, 'content/about.md'), 'utf8'))
const aboutPage = { title: about.data.title, html: render(about.content) }
const cv = matter(readFileSync(join(root, 'content/cv.md'), 'utf8'))
const cvPage = { title: cv.data.title, html: render(cv.content) }

const version = createHash('sha1').update(JSON.stringify({ posts, aboutPage, cvPage })).digest('hex').slice(0, 12)

writeFileSync(
  join(root, 'src/posts.generated.js'),
  `export const posts = ${JSON.stringify(posts)}\nexport const about = ${JSON.stringify(aboutPage)}\nexport const cv = ${JSON.stringify(cvPage)}\nexport const version = ${JSON.stringify(version)}\n`
)
console.log(`Built ${posts.length} posts (version ${version})`)
