/**
 * /api/delete — delete your Agent Wrapped page.
 * POST { name } → deletes pages/<name>.json from main → returns confirmation.
 */

export const config = { runtime: 'edge' };

const REPO = 'vellum-ai/agent-wrapped';
const BRANCH = 'main';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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

  const filePath = `pages/${name}.json`;

  try {
    // find the file sha
    let fileSha;
    try {
      const existing = await gh(token, 'GET', `/repos/${REPO}/contents/${encodeURIComponent(filePath)}?ref=${BRANCH}`);
      fileSha = existing.sha;
    } catch {
      return json({ error: `No page found for "${name}"` }, 404);
    }

    await gh(token, 'DELETE', `/repos/${REPO}/contents/${encodeURIComponent(filePath)}`, {
      message: `pages: delete ${name}'s wrapped`,
      sha: fileSha,
      branch: BRANCH,
    });

    return json({ ok: true, deleted: true, name, url: `https://agent-wrapped.com/${name}` });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
