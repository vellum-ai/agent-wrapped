'use strict';
/**
 * OpenClaw source adapter.
 *
 * Reads OpenClaw's on-disk state (~/.openclaw by default, or $OPENCLAW_HOME)
 * and produces the raw material for wrapped stats:
 *   - sessions: agents/<agentId>/sessions/sessions.json index
 *     + one .jsonl transcript per session (legacy layout: sessions/ at root)
 *   - user messages: transcript lines with message.role "user"
 *   - titles: the session label from the index, or the first user message
 *   - memories: entry lines in MEMORY.md + memory/<date>.md
 *     (workspace/ preferred, root fallback)
 *
 * Subagent sessions (key contains ":subagent:") count as activity but not
 * as distinct conversations.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function defaultDir() {
  return process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
}

function listSessionStores(openclawDir) {
  const stores = [];
  const agentsDir = path.join(openclawDir, 'agents');
  try {
    for (const agent of fs.readdirSync(agentsDir)) {
      const dir = path.join(agentsDir, agent, 'sessions');
      if (fs.existsSync(path.join(dir, 'sessions.json')) || dirHasJsonl(dir)) stores.push(dir);
    }
  } catch {
    /* no agents dir */
  }
  // legacy single-store layout
  const legacy = path.join(openclawDir, 'sessions');
  if (fs.existsSync(path.join(legacy, 'sessions.json')) || dirHasJsonl(legacy)) stores.push(legacy);
  return stores;
}

function dirHasJsonl(dir) {
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith('.jsonl'));
  } catch {
    return false;
  }
}

function listTranscripts(storeDir) {
  const files = [];
  for (const sub of ['', 'transcripts']) {
    const dir = path.join(storeDir, sub);
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (f.endsWith('.jsonl')) files.push(path.join(dir, f));
    }
  }
  return files;
}

function readIndex(storeDir) {
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(storeDir, 'sessions.json'), 'utf8'));
    return idx && typeof idx === 'object' ? idx : {};
  } catch {
    return {};
  }
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join(' ');
  }
  return '';
}

function parseTranscript(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const session = { firstTimestamp: null, userTexts: [] };
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = msg.timestamp || msg.ts;
    if (ts && !session.firstTimestamp) session.firstTimestamp = ts;
    const m = msg.message;
    if (!m || m.role !== 'user') continue;
    const text = textOf(m.content);
    if (!text || text.startsWith('<')) continue;
    session.userTexts.push(text);
  }
  return session.firstTimestamp || session.userTexts.length ? session : null;
}

function toDateString(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') {
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(ts);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

function countMemories(openclawDir) {
  const entryRe = /^\s*([-*]|\d+\.|#{1,3})\s+\S/;
  let count = 0;
  const roots = [path.join(openclawDir, 'workspace'), openclawDir];
  const seen = new Set();
  for (const root of roots) {
    const memFile = path.join(root, 'MEMORY.md');
    if (!seen.has(memFile) && fs.existsSync(memFile)) {
      seen.add(memFile);
      count += fs.readFileSync(memFile, 'utf8').split('\n').filter((l) => entryRe.test(l)).length;
    }
    const memDir = path.join(root, 'memory');
    if (seen.has(memDir)) continue;
    seen.add(memDir);
    let entries = [];
    try {
      entries = fs.readdirSync(memDir).filter((f) => f.endsWith('.md'));
    } catch {
      continue;
    }
    for (const f of entries) {
      count += fs
        .readFileSync(path.join(memDir, f), 'utf8')
        .split('\n')
        .filter((l) => entryRe.test(l)).length;
    }
  }
  return count;
}

function snippet(text) {
  return String(text).split(/\s+/).slice(0, 12).join(' ');
}

/**
 * @param {object} opts { openclawDir? }
 * @returns {{ conversations, realConversations, firstDate, titles, userTexts, memories }}
 */
function read(opts = {}) {
  const openclawDir = opts.openclawDir || defaultDir();
  const stores = listSessionStores(openclawDir);

  let conversations = 0;
  let realConversations = 0;
  const titles = [];
  const userTexts = [];
  const dates = [];

  for (const store of stores) {
    const index = readIndex(store);
    // map sessionId -> { key, label } from the index
    const byId = new Map();
    for (const [key, row] of Object.entries(index)) {
      if (row && row.sessionId) byId.set(row.sessionId, { key, label: row.label });
    }
    for (const file of listTranscripts(store)) {
      const session = parseTranscript(file);
      if (!session || !session.userTexts.length) continue;
      const id = path.basename(file, '.jsonl');
      const meta = byId.get(id) || { key: id, label: null };
      const isSubagent = String(meta.key).includes(':subagent:');
      conversations += 1;
      if (!isSubagent) {
        realConversations += 1;
        titles.push(meta.label || snippet(session.userTexts[0]));
      }
      userTexts.push(...session.userTexts);
      const d = toDateString(session.firstTimestamp);
      if (d) dates.push(d);
    }
  }

  dates.sort();
  return {
    conversations,
    realConversations,
    firstDate: dates[0] || null,
    titles,
    userTexts,
    memories: countMemories(openclawDir),
  };
}

function detect(opts = {}) {
  const openclawDir = opts.openclawDir || defaultDir();
  return listSessionStores(openclawDir).length > 0;
}

module.exports = { read, detect, defaultDir };
