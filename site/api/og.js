import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const PAGES_BASE = 'https://raw.githubusercontent.com/vellum-ai/agent-wrapped/main/pages/';

const LIME = '#d7f45a';
const INK = '#0c0c0c';

let fontPromise = null;
function loadFont() {
  if (!fontPromise) {
    fontPromise = fetch('https://fonts.googleapis.com/css2?family=Audiowide', {
      headers: { 'User-Agent': 'Mozilla/4.0' },
    })
      .then((r) => r.text())
      .then((css) => {
        const m = css.match(/url\((https:[^)]+\.ttf)\)/);
        if (!m) throw new Error('no ttf url');
        return fetch(m[1]).then((r) => r.arrayBuffer());
      })
      .catch(() => null);
  }
  return fontPromise;
}

function el(type, style, children) {
  return { type, props: { style, children } };
}

function stat(value, label) {
  return el('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }, [
    el('div', { display: 'flex', fontSize: 64, fontWeight: 700, color: LIME, lineHeight: 1.1 }, String(value)),
    el('div', { display: 'flex', fontSize: 22, color: '#eaeaea', opacity: 0.75 }, label),
  ]);
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get('name') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!name) return new Response('missing name', { status: 400 });

  let page;
  try {
    const r = await fetch(PAGES_BASE + name + '.json');
    if (!r.ok) return new Response('not found', { status: 404 });
    page = await r.json();
  } catch {
    return new Response('fetch failed', { status: 502 });
  }

  const font = await loadFont();
  const title = `${page.assistant}, wrapped`;

  const tree = el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: INK,
      backgroundImage: `radial-gradient(circle at 85% 15%, rgba(215,244,90,0.18), transparent 55%), radial-gradient(circle at 10% 90%, rgba(168,224,95,0.12), transparent 50%)`,
      padding: 64,
      fontFamily: font ? 'Audiowide, sans-serif' : 'sans-serif',
    },
    [
      el('div', { display: 'flex', flexDirection: 'column' }, [
        el('div', { display: 'flex', fontSize: 26, color: LIME, letterSpacing: 4, textTransform: 'uppercase' }, 'Agent Wrapped'),
        el('div', { display: 'flex', fontSize: 88, fontWeight: 700, color: '#ffffff', marginTop: 12, lineHeight: 1.05 }, title),
        el('div', { display: 'flex', fontSize: 28, color: '#eaeaea', opacity: 0.8, marginTop: 16 }, page.era || ''),
      ]),
      el('div', { display: 'flex', justifyContent: 'space-between', width: '100%' }, [
        stat((page.conversations ?? 0).toLocaleString('en-US'), 'conversations'),
        stat(page.daysTogether ?? 0, 'days together'),
        stat(page.memories ?? 0, 'memories'),
        stat(page.swears ?? 0, 'times you swore'),
      ]),
    ]
  );

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    fonts: font ? [{ name: 'Audiowide', data: font, style: 'normal', weight: 400 }] : undefined,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
