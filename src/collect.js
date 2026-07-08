'use strict';
/**
 * Assistant Wrapped — stats collector.
 *
 * Scans the assistant's workspace (conversations, memory) and produces the
 * stats that power the Assistant Wrapped cards. Shared by the `wrapped` CLI
 * (bin/wrapped.js) and the `wrapped_stats` plugin tool.
 */

const fs = require('fs');
const path = require('path');

const SWEAR_RE = /\b(fuck\w*|shit\w*|wtf|damn\w*|bitch\w*|asshole\w*|bullshit|crap)\b/gi;

const BASE_STOPWORDS = `a an and the of for to in on with at from into over under about is are was be
new setup update updates fix fixes fixed check debug review draft session work test
testing plan planning discussion chat conversation quick follow follow-up up
request question help idea ideas notes note it its this that your my our vs
using use how what when why via without more less first second next last
assistant title generating untitled done complete completed
summary ready invite recap call log integration access issue bug banter
week daily previous yesterday today post reminder inbound non-guardian
guardian message inquiry background job failed image content analysis
external`.split(/\s+/).filter(Boolean);

const PLACEHOLDER_TITLE_RE = /generating title|untitled conversation|^done\.?$|^reminder$/i;

const ERA_MAP = {
  casual: 'The bestie era',
  release: 'The shipping era',
  plugin: 'The builder era',
  plugins: 'The builder era',
  app: 'The builder era',
  docs: 'The documentation era',
  memory: 'The remembering era',
  offsite: 'The planning era',
  travel: 'The planning era',
  cut: 'The discipline era',
  fitness: 'The discipline era',
  gym: 'The discipline era',
};

function loadConfig(pluginDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pluginDir, 'config.json'), 'utf8'));
  } catch {
    return {};
  }
}

function listConversations(convDir) {
  let entries;
  try {
    entries = fs.readdirSync(convDir);
  } catch {
    return [];
  }
  return entries.filter((d) => {
    try {
      return fs.statSync(path.join(convDir, d)).isDirectory();
    } catch {
      return false;
    }
  });
}

function dateFromDirName(name) {
  // 2026-04-29T20-56-26.410Z_<uuid>
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function collectDaysTogether(dirs) {
  const dates = dirs.map(dateFromDirName).filter(Boolean).sort();
  if (!dates.length) return { days: 0, first: null, last: null };
  const first = dates[0];
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round((new Date(today) - new Date(first)) / 86400000) + 1;
  return { days, first, last: today };
}

function collectMemories(memoryDir) {
  try {
    return fs.readdirSync(memoryDir).filter((f) => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

function collectSwears(convDir, dirs) {
  let count = 0;
  for (const dir of dirs) {
    const file = path.join(convDir, dir, 'messages.jsonl');
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.role !== 'user' || typeof msg.content !== 'string') continue;
      const matches = msg.content.match(SWEAR_RE);
      if (matches) count += matches.length;
    }
  }
  return count;
}

function readMeta(convDir, dir) {
  const metaFile = path.join(convDir, dir, 'meta.json');
  if (!fs.existsSync(metaFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  } catch {
    return null;
  }
}

function collectTopTopics(convDir, dirs, stopwords, topN) {
  const counts = new Map();
  for (const dir of dirs) {
    const meta = readMeta(convDir, dir);
    if (!meta) continue;
    // only real conversations — skip background jobs and scheduled tasks
    if (meta.type && meta.type !== 'standard') continue;
    if (!meta.title || PLACEHOLDER_TITLE_RE.test(meta.title)) continue;
    const words = meta.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));
    // unigrams (count once per title)
    for (const w of new Set(words)) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    // bigrams (count once per title)
    const bigrams = new Set();
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    for (const b of bigrams) {
      counts.set(b, (counts.get(b) || 0) + 1);
    }
  }
  // prefer bigrams — they carry real meaning ("release notes" > "release")
  const sorted = [...counts.entries()]
    .map(([term, n]) => ({ term, count: n, score: term.includes(' ') ? n * 3 : n }))
    .sort((a, b) => b.score - a.score);
  const picked = [];
  for (const { term, count } of sorted) {
    if (picked.length >= topN) break;
    if (picked.some((p) => p.term.includes(term) || term.includes(p.term))) continue;
    picked.push({ term, count });
  }
  return picked.map((p, i) => ({
    rank: i + 1,
    topic: p.term.replace(/\b\w/g, (c) => c.toUpperCase()),
    count: p.count,
  }));
}

function deriveEra(topics) {
  if (!topics.length) return 'The mysterious era';
  const top = topics[0].topic.split(' ')[0].toLowerCase();
  return ERA_MAP[top] || `The ${top} era`;
}

/**
 * Collect Assistant Wrapped stats.
 *
 * @param {object} [opts]
 * @param {string} [opts.workspace]  Workspace root (default: $VELLUM_WORKSPACE_DIR or /workspace)
 * @param {number} [opts.topN]       Number of top topics to return (default 5)
 * @returns {object} stats
 */
function collect(opts = {}) {
  const workspace = opts.workspace || process.env.VELLUM_WORKSPACE_DIR || '/workspace';
  const topN = opts.topN || 5;
  const convDir = path.join(workspace, 'conversations');
  const memoryDir = path.join(workspace, 'memory', 'concepts');
  const config = loadConfig(path.join(__dirname, '..'));
  const stopwords = new Set([
    ...BASE_STOPWORDS,
    ...(Array.isArray(config.extraStopwords) ? config.extraStopwords.map((w) => String(w).toLowerCase()) : []),
  ]);

  const dirs = listConversations(convDir);
  const daysInfo = collectDaysTogether(dirs);
  const topics = collectTopTopics(convDir, dirs, stopwords, topN);
  const realDirs = dirs.filter((d) => {
    const meta = readMeta(convDir, d);
    return meta && (!meta.type || meta.type === 'standard');
  });

  return {
    generatedAt: new Date().toISOString(),
    conversations: dirs.length,
    realConversations: realDirs.length,
    daysTogether: daysInfo.days,
    firstConversation: daysInfo.first,
    memories: collectMemories(memoryDir),
    swears: collectSwears(convDir, dirs),
    topTopics: topics,
    era: deriveEra(topics),
  };
}

function formatSummary(stats) {
  const lines = [
    '── Assistant Wrapped ──',
    `Conversations:   ${stats.conversations.toLocaleString()}`,
    `Days together:   ${stats.daysTogether} (since ${stats.firstConversation})`,
    `Memories formed: ${stats.memories}`,
    `Times you swore: ${stats.swears}`,
    'Top topics:',
    ...stats.topTopics.map((t) => `  #${t.rank} ${t.topic} (${t.count})`),
    `Era:             ${stats.era}`,
  ];
  return lines.join('\n');
}

module.exports = { collect, formatSummary };
