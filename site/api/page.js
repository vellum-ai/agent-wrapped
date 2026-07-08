export const config = { runtime: 'edge' };

const PAGES_BASE = 'https://raw.githubusercontent.com/vellum-ai/agent-wrapped/main/pages/';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const name = (url.searchParams.get('name') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');

  // always serve the SPA shell; upgrade with meta when the page exists
  const shellRes = await fetch(`${origin}/app.html`);
  let html = await shellRes.text();

  if (name) {
    try {
      const r = await fetch(PAGES_BASE + name + '.json');
      if (r.ok) {
        const page = await r.json();
        const title = `${esc(page.assistant)}, wrapped — Agent Wrapped`;
        const desc = esc(
          page.tagline ||
            `${(page.conversations ?? 0).toLocaleString('en-US')} conversations, ${page.daysTogether ?? 0} days together, ${page.memories ?? 0} memories, ${page.swears ?? 0} swears. ${page.era || ''}`
        );
        const pageUrl = `${origin}/${name}`;
        const img = `${origin}/api/og?name=${name}`;
        const meta = [
          `<title>${title}</title>`,
          `<meta name="description" content="${desc}">`,
          `<meta property="og:type" content="website">`,
          `<meta property="og:site_name" content="Agent Wrapped">`,
          `<meta property="og:title" content="${title}">`,
          `<meta property="og:description" content="${desc}">`,
          `<meta property="og:url" content="${pageUrl}">`,
          `<meta property="og:image" content="${img}">`,
          `<meta property="og:image:width" content="1200">`,
          `<meta property="og:image:height" content="630">`,
          `<meta name="twitter:card" content="summary_large_image">`,
          `<meta name="twitter:title" content="${title}">`,
          `<meta name="twitter:description" content="${desc}">`,
          `<meta name="twitter:image" content="${img}">`,
        ].join('\n');
        html = html.replace(/<title>[^<]*<\/title>/, '').replace('</head>', meta + '\n</head>');
      }
    } catch {
      /* serve plain shell */
    }
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
