#!/usr/bin/env node
/**
 * wrapped-publish — publish your Agent Wrapped as a share page.
 *
 * Two modes:
 *
 *   --push    Direct publish. POSTs to agent-wrapped.com/api/publish,
 *             commits to main, page is LIVE instantly. No fork, no PR.
 *
 *   (default) Fork + PR. Forks vellum-ai/agent-wrapped, commits your
 *             stats JSON, opens a PR. Page goes live after merge.
 *
 * NOTHING is uploaded without your explicit confirmation. The script shows
 * you exactly what will be published and asks first (or pass --yes).
 *
 * Usage:
 *   node publish.js --name <name> [--push] [--file <stats.json>] [--assistant <display>]
 *                   [--emoji <emoji>] [--tagline <text>] [--yes]
 *
 * Auth for PR mode (either works):
 *   - gh CLI logged in (`gh auth status`)
 *   - GITHUB_TOKEN env var (needs repo + workflow scopes for fork/PR)
 *
 * --push mode needs no GitHub auth — the server handles it.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const { collect } = require('../src/collect.js');

const UPSTREAM = 'vellum-ai/agent-wrapped';
const SITE = 'https://agent-wrapped.com';
const PUBLISH_API = 'https://agent-wrapped.com/api/publish';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const has = (name) => args.includes(name);

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/* ── auth ── */

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function gh(token, method, endpoint, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) {
    throw new Error(`${method} ${endpoint} → ${res.status}: ${data.message || 'unknown error'}`);
  }
  return data;
}

/* ── consent ── */

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim().toLowerCase()); }));
}

/* ── main ── */

(async () => {
  const name = (flag('--name') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!name) die('Missing --name <name>. This becomes your URL: ' + SITE + '/<name>');

  // 1. load or generate stats
  let stats;
  const file = flag('--file');
  if (file) {
    try {
      stats = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      die(`Could not read ${file}: ${e.message}`);
    }
  } else {
    console.log('No --file given, generating stats now…');
    stats = collect({ source: flag('--source') || 'auto' });
  }

  // 2. page metadata
  const page = {
    assistant: flag('--assistant') || stats.assistant || name.charAt(0).toUpperCase() + name.slice(1),
    emoji: flag('--emoji') || stats.emoji || '🤖',
    ...(flag('--tagline') || stats.tagline ? { tagline: flag('--tagline') || stats.tagline } : {}),
    ...stats,
  };
  delete page.source;
  const pageJson = JSON.stringify(page, null, 2);

  // 3. consent gate — show exactly what leaves the machine
  console.log('\n── This is EXACTLY what will be published ──\n');
  console.log(pageJson);
  if (has('--push')) {
    console.log(`\n── It will be LIVE instantly at ${SITE}/${name} ──\n`);
  } else {
    console.log(`\n── It will be public at ${SITE}/${name} (after PR review + merge) ──\n`);
  }
  if (!has('--yes')) {
    const answer = await ask('Publish this? [y/N] ');
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Aborted. Nothing was uploaded.');
      process.exit(0);
    }
  }

  // 4. publish — direct push or fork+PR
  if (has('--push')) {
    console.log('\nPublishing directly…');
    const res = await fetch(PUBLISH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, page: JSON.parse(pageJson) }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      die(result.error || `Server error ${res.status}`);
    }
    console.log(`\n✓ LIVE at ${result.url}`);
    console.log(`Commit: ${result.commit}`);
    return;
  }

  // PR mode: auth + fork + branch + commit + PR
  const token = getToken();
  if (!token) die('No GitHub auth found. Log in with `gh auth login` or set GITHUB_TOKEN.');
  const me = await gh(token, 'GET', '/user');
  console.log(`\nAuthenticated as ${me.login}`);

  // 5. fork (idempotent; 202 = fork queued)
  console.log(`Forking ${UPSTREAM}…`);
  await gh(token, 'POST', `/repos/${UPSTREAM}/forks`, {});
  const forkRepo = `${me.login}/agent-wrapped`;
  // wait for the fork to be ready
  for (let i = 0; i < 10; i++) {
    try {
      await gh(token, 'GET', `/repos/${forkRepo}`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // 6. sync fork's main with upstream (best effort)
  try {
    await gh(token, 'POST', `/repos/${forkRepo}/merge-upstream`, { branch: 'main' });
  } catch {
    /* fresh forks are already in sync */
  }

  // 7. create a branch off main
  const mainRef = await gh(token, 'GET', `/repos/${forkRepo}/git/ref/heads/main`);
  const branch = `wrapped/${name}-${Date.now().toString(36)}`;
  await gh(token, 'POST', `/repos/${forkRepo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: mainRef.object.sha,
  });

  // 8. commit the page file (create or update)
  const filePath = `pages/${name}.json`;
  let existingSha;
  try {
    const existing = await gh(token, 'GET', `/repos/${forkRepo}/contents/${filePath}?ref=${branch}`);
    existingSha = existing.sha;
  } catch {
    /* new page */
  }
  await gh(token, 'PUT', `/repos/${forkRepo}/contents/${encodeURI(filePath)}`, {
    message: `pages: ${existingSha ? 'update' : 'publish'} ${name}'s wrapped`,
    content: Buffer.from(pageJson + '\n').toString('base64'),
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  });

  // 9. open the PR against upstream
  const pr = await gh(token, 'POST', `/repos/${UPSTREAM}/pulls`, {
    title: `pages: ${page.assistant}'s wrapped (${name})`,
    head: `${me.login}:${branch}`,
    base: 'main',
    body: [
      `Publishing **${page.assistant}**'s Agent Wrapped 🎁`,
      '',
      `- Page: \`${filePath}\` → will be live at ${SITE}/${name}`,
      `- Source: ${stats.source || 'unknown'}`,
      `- Generated: ${stats.generatedAt || 'unknown'}`,
      '',
      '_Opened with `wrapped-publish` from the agent-wrapped plugin._',
    ].join('\n'),
  });

  console.log(`\n✓ PR opened: ${pr.html_url}`);
  console.log(`Once merged, your page is live at ${SITE}/${name}`);
})().catch((e) => die(e.message));
