/**
 * /api/publish — direct publish your Agent Wrapped page.
 * POST { name, page } → commits pages/<name>.json to main → returns live URL.
 */

export const config = { runtime: 'edge' };

const REPO = 'vellum-ai/agent-wrapped';
const BRANCH = 'main';
const REQUIRED = ['assistant', 'conversations', 'daysTogether', 'memories', 'swears'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function gh(token, method, endpoint, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${data.message || 'unknown'}`);
  return data;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const token = process.env.GITHUB_TOKEN;
  if (!token) return json({ error: 'Server not configured' }, 500);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const name = (body.name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!name || name.length < 2) return json({ error: 'name required (min 2 chars, a-z 0-9 _ -)' }, 400);

  const page = body.page;
  if (!page || typeof page !== 'object') return json({ error: 'page object required' }, 400);

  const missing = REQUIRED.filter((f) => page[f] === undefined || page[f] === null);
  if (missing.length) return json({ error: `Missing: ${missing.join(', ')}` }, 400);

  delete page.source;

  const pageJson = JSON.stringify(page, null, 2) + '\n';
  const content = toBase64(pageJson);

  try {
    // Check if name is taken; auto-increment if so
    let finalName = name;
    let existingSha;
    try {
      const existing = await gh(token, 'GET', `/repos/${REPO}/contents/${encodeURIComponent(`pages/${finalName}.json`)}?ref=${BRANCH}`);
      existingSha = existing.sha;
    } catch { /* name is free */ }

    if (existingSha) {
      // Name taken, find next available slot
      let suffix = 1;
      while (suffix < 100) {
        const tryName = `${name}-${suffix}`;
        try {
          await gh(token, 'GET', `/repos/${REPO}/contents/${encodeURIComponent(`pages/${tryName}.json`)}?ref=${BRANCH}`);
          suffix++;
        } catch {
          finalName = tryName;
          existingSha = undefined;
          break;
        }
      }
      if (existingSha) return json({ error: `Page "${name}" exists and auto-increment failed after 99 attempts` }, 409);
    }

    const filePath = `pages/${finalName}.json`;

    const result = await gh(token, 'PUT', `/repos/${REPO}/contents/${encodeURIComponent(filePath)}`, {
      message: `pages: ${existingSha ? 'update' : 'publish'} ${finalName}'s wrapped`,
      content,
      branch: BRANCH,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    const url = `https://agent-wrapped.com/${finalName}`;
    return json({ ok: true, url, name: finalName, commit: result.commit?.sha, updated: !!existingSha, renamed: finalName !== name });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
