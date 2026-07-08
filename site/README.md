# agent-wrapped.vercel.app

The share site. Landing page (`index.html`), the coverflow cards SPA
(`app.html` + built `app.js`/`app.css`), and two edge functions:

- `api/page.js` — serves the SPA shell for `/<name>` with per-page
  OG/Twitter meta injected (crawlers don't run JS)
- `api/og.js` — generates the 1200x630 share image from `pages/<name>.json`

## Rebuild the bundle

The SPA source is in `src/`. Build with esbuild + preact:

```
esbuild src/site-main.tsx --bundle --minify --format=iife \
  --alias:preact=<path-to-preact> --jsx=automatic --jsx-import-source=preact \
  --loader:.woff=dataurl --loader:.woff2=dataurl --loader:.svg=dataurl \
  --outfile=app.js
```

(esbuild emits `app.css` beside it from the CSS import.)

## Deploy

Vercel project `agent-wrapped`, no framework. Deploy the files listed in
`vercel.json`'s rewrites plus `package.json` and `api/`. Data pages are NOT
deployed — the SPA fetches `pages/<name>.json` from this repo raw at runtime,
so a merged pages PR is live without a redeploy.
