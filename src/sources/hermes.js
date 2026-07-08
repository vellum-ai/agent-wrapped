'use strict';
/**
 * Hermes Agent source adapter.
 *
 * Reads Hermes Agent's on-disk state (~/.hermes by default, or $HERMES_HOME)
 * and produces the raw material for wrapped stats:
 *   - sessions + messages: state.db (SQLite, WAL mode)
 *   - titles: session title, or the first user message of the session
 *   - memories: entry lines in the built-in MEMORY.md / USER.md
 *
 * Zero dependencies: uses node:sqlite (Node >= 22.5) or bun:sqlite,
 * whichever the runtime provides. The database is opened read-only.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function defaultDir() {
  return process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
}

function openDb(dbPath) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: true });
    return { all: (sql) => db.prepare(sql).all(), close: () => db.close() };
  } catch (err) {
    if (err && (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND')) {
      // fall through to bun:sqlite
    } else if (!/node:sqlite/.test(String(err))) {
      throw err;
    }
  }
  try {
    const { Database } = require('bun:sqlite');
    const db = new Database(dbPath, { readonly: true });
    return { all: (sql) => db.prepare(sql).all(), close: () => db.close() };
  } catch {
    throw new Error(
      'Reading Hermes history needs SQLite support: run with Node 22.5+ or Bun.'
    );
  }
}

function countMemories(hermesDir) {
  let count = 0;
  for (const f of ['MEMORY.md', 'USER.md']) {
    try {
      const md = fs.readFileSync(path.join(hermesDir, f), 'utf8');
      count += md.split('\n').filter((l) => /^\s*([-*]|\d+\.|#{1,3})\s+\S/.test(l)).length;
    } catch {
      /* file absent */
    }
  }
  return count;
}

function snippet(text) {
  return String(text).split(/\s+/).slice(0, 12).join(' ');
}

/**
 * @param {object} opts { hermesDir? }
 * @returns {{ conversations, realConversations, firstDate, titles, userTexts, memories }}
 */
function read(opts = {}) {
  const hermesDir = opts.hermesDir || defaultDir();
  const dbPath = path.join(hermesDir, 'state.db');
  const db = openDb(dbPath);
  try {
    const sessions = db.all(
      'SELECT id, parent_session_id, started_at, title FROM sessions ORDER BY started_at'
    );
    const userMsgs = db.all(
      "SELECT session_id, content FROM messages WHERE role = 'user' AND content IS NOT NULL AND content != ''"
    );

    const bySession = new Map();
    for (const m of userMsgs) {
      if (!bySession.has(m.session_id)) bySession.set(m.session_id, []);
      bySession.get(m.session_id).push(m.content);
    }

    const active = sessions.filter((s) => bySession.has(s.id));
    // Compression splits chain sessions via parent_session_id; lineage roots
    // are the actual distinct conversations.
    const roots = active.filter((s) => !s.parent_session_id);

    const titles = roots
      .map((s) => s.title || snippet(bySession.get(s.id)[0]))
      .filter(Boolean);

    const firstEpoch = sessions.length ? sessions[0].started_at : null;
    const firstDate = firstEpoch
      ? new Date(firstEpoch * 1000).toISOString().slice(0, 10)
      : null;

    return {
      conversations: active.length,
      realConversations: roots.length,
      firstDate,
      titles,
      userTexts: userMsgs.map((m) => m.content),
      memories: countMemories(hermesDir),
    };
  } finally {
    db.close();
  }
}

function detect(opts = {}) {
  const hermesDir = opts.hermesDir || defaultDir();
  try {
    return fs.statSync(path.join(hermesDir, 'state.db')).isFile();
  } catch {
    return false;
  }
}

module.exports = { read, detect, defaultDir };
