'use strict';
/**
 * Claude Code source adapter.
 *
 * Reads Claude Code's on-disk history (~/.claude by default, or
 * $CLAUDE_CONFIG_DIR) and produces the raw material for wrapped stats:
 *   - sessions: projects/<encoded-cwd>/<session-uuid>.jsonl
 *   - user messages: lines with type "user" (sidechains excluded)
 *   - titles: the first human prompt of each session
 *   - memories: entry lines in the global CLAUDE.md, if present
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function defaultDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function listSessionFiles(claudeDir) {
  const projectsDir = path.join(claudeDir, 'projects');
  let projects;
  try {
    projects = fs.readdirSync(projectsDir);
  } catch {
    return [];
  }
  const files = [];
  for (const p of projects) {
    const dir = path.join(projectsDir, p);
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

function isHumanUserLine(msg) {
  if (msg.type !== 'user' || msg.isSidechain) return false;
  if (!msg.message || msg.message.role !== 'user') return false;
  const text = textOf(msg.message.content);
  if (!text) return false;
  // skip slash-command wrappers and injected system-ish content
  if (text.startsWith('<')) return false;
  if (msg.origin && msg.origin.kind && msg.origin.kind !== 'human') return false;
  return true;
}

function parseSession(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const session = { firstTimestamp: null, title: null, userTexts: [] };
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.timestamp && !session.firstTimestamp) session.firstTimestamp = msg.timestamp;
    if (msg.type === 'summary' && typeof msg.summary === 'string' && !session.title) {
      session.title = msg.summary;
    }
    if (isHumanUserLine(msg)) {
      const text = textOf(msg.message.content);
      session.userTexts.push(text);
      if (!session.title) session.title = text.split(/\s+/).slice(0, 12).join(' ');
    }
  }
  return session.firstTimestamp || session.userTexts.length ? session : null;
}

function countMemories(claudeDir) {
  try {
    const md = fs.readFileSync(path.join(claudeDir, 'CLAUDE.md'), 'utf8');
    return md.split('\n').filter((l) => /^\s*([-*]|\d+\.|#{1,3})\s+\S/.test(l)).length;
  } catch {
    return 0;
  }
}

/**
 * @param {object} opts { claudeDir? }
 * @returns {{ conversations, realConversations, firstDate, titles, userTexts, memories }}
 */
function read(opts = {}) {
  const claudeDir = opts.claudeDir || defaultDir();
  const files = listSessionFiles(claudeDir);
  const sessions = files.map(parseSession).filter(Boolean);
  const dates = sessions
    .map((s) => (s.firstTimestamp ? s.firstTimestamp.slice(0, 10) : null))
    .filter(Boolean)
    .sort();
  return {
    conversations: sessions.length,
    realConversations: sessions.length,
    firstDate: dates[0] || null,
    titles: sessions.map((s) => s.title).filter(Boolean),
    userTexts: sessions.flatMap((s) => s.userTexts),
    memories: countMemories(claudeDir),
  };
}

function detect(opts = {}) {
  const claudeDir = opts.claudeDir || defaultDir();
  try {
    return fs.statSync(path.join(claudeDir, 'projects')).isDirectory();
  } catch {
    return false;
  }
}

module.exports = { read, detect, defaultDir };
