# sorsby.co

A minimal blog on a single Cloudflare Worker.

- Posts live in `content/posts/**.md` (frontmatter: `title`, `date`, `tags`, `summary`, optional `lastmod`, `draft`). `content/about.md` is the about page.
- `npm run build` renders markdown to HTML once into `src/posts.generated.js`; the Worker (`src/worker.js`) only does routing and templating.
- Every response (pages, feed, 404s, redirects and static files) is cached for 10 minutes in the browser and at the Cloudflare edge. The edge cache key includes a content hash, so a new deploy never serves stale pages from an older build.
- `public/` (favicons, images) is served by Workers static assets.

```sh
npm install
npm run dev      # local preview
npm run deploy   # needs CLOUDFLARE_API_TOKEN
```

The Cache API only works on custom domains, not `*.workers.dev`, so attach `sorsby.co` as a route or custom domain. CI (`.github/workflows/deploy.yml`) needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
