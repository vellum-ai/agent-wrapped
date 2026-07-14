'use strict';
/**
 * Agent Wrapped — stats collector.
 *
 * Multi-source: reads assistant history from a supported source and produces
 * the stats that power the Assistant Wrapped cards. Shared by the `wrapped`
 * CLI (bin/wrapped.js) and the `wrapped_stats` plugin tool.
 *
 * Sources:
 *   - vellum: Vellum assistant workspace (conversations/ + memory/concepts/)
 *   - claude: Claude Code (~/.claude projects/<cwd>/<session>.jsonl)
 *   - hermes: Hermes Agent (~/.hermes/state.db SQLite)
 *   - openclaw: OpenClaw (~/.openclaw agents/<id>/sessions JSONL)
 *   - auto:   first of vellum, claude, hermes, openclaw with data present
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const claudeSource = require('./sources/claude.js');
const hermesSource = require('./sources/hermes.js');
const openclawSource = require('./sources/openclaw.js');

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
external can you please could would make add create let get run tell need want
look see show read write file files code change changes there here just also
still like know think try trying going want wanted`.split(/\s+/).filter(Boolean);

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
  skill: 'The builder era',
  pr: 'The shipping era',
  deploy: 'The shipping era',
};

function loadConfig(pluginDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pluginDir, 'config.json'), 'utf8'));
  } catch {
    return {};
  }
}

/* ── vellum source ── */

function vellumRead(workspace) {
  const convDir = path.join(workspace, 'conversations');
  const memoryDir = path.join(workspace, 'memory', 'concepts');

  let dirs = [];
  try {
    dirs = fs.readdirSync(convDir).filter((d) => {
      try {
        return fs.statSync(path.join(convDir, d)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    /* no workspace */
  }

  const titles = [];
  let realCount = 0;
  const userTexts = [];

  for (const dir of dirs) {
    // meta: title + type
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(convDir, dir, 'meta.json'), 'utf8'));
      const isStandard = !meta.type || meta.type === 'standard';
      if (isStandard) {
        realCount++;
        if (meta.title && !PLACEHOLDER_TITLE_RE.test(meta.title)) titles.push(meta.title);
      }
    } catch {
      /* skip */
    }
    // user messages
    const file = path.join(convDir, dir, 'messages.jsonl');
    if (!fs.existsSync(file)) continue;
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.role === 'user' && typeof msg.content === 'string') userTexts.push(msg.content);
    }
  }

  const dates = dirs
    .map((d) => (d.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1])
    .filter(Boolean)
    .sort();

  let memories = 0;
  try {
    memories = fs.readdirSync(memoryDir).filter((f) => f.endsWith('.md')).length;
  } catch {
    /* none */
  }

  return {
    conversations: dirs.length,
    realConversations: realCount,
    firstDate: dates[0] || null,
    titles,
    userTexts,
    memories,
  };
}

function vellumDetect(workspace) {
  try {
    return fs.statSync(path.join(workspace, 'conversations')).isDirectory();
  } catch {
    return false;
  }
}

/* ── shared analysis ── */

function countSwears(userTexts) {
  let count = 0;
  for (const text of userTexts) {
    const matches = text.match(SWEAR_RE);
    if (matches) count += matches.length;
  }
  return count;
}

function topTopics(titles, stopwords, topN) {
  const counts = new Map();
  for (const title of titles) {
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));
    for (const w of new Set(words)) counts.set(w, (counts.get(w) || 0) + 1);
    const bigrams = new Set();
    for (let i = 0; i < words.length - 1; i++) bigrams.add(`${words[i]} ${words[i + 1]}`);
    for (const b of bigrams) counts.set(b, (counts.get(b) || 0) + 1);
  }
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

function daysSince(firstDate) {
  if (!firstDate) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(today) - new Date(firstDate)) / 86400000) + 1;
}

/* ── orchestrator ── */

/**
 * Collect Assistant Wrapped stats.
 *
 * @param {object} [opts]
 * @param {string} [opts.source]     'vellum' | 'claude' | 'hermes' | 'openclaw' | 'auto' (default 'auto')
 * @param {string} [opts.workspace]  Vellum workspace root (default: $VELLUM_WORKSPACE_DIR or /workspace)
 * @param {string} [opts.claudeDir]  Claude Code config dir (default: $CLAUDE_CONFIG_DIR or ~/.claude)
 * @param {string} [opts.hermesDir]  Hermes home dir (default: $HERMES_HOME or ~/.hermes)
 * @param {string} [opts.openclawDir] OpenClaw home dir (default: $OPENCLAW_HOME or ~/.openclaw)
 * @param {number} [opts.topN]       Number of top topics to return (default 5)
 */
function collect(opts = {}) {
  const workspace = opts.workspace || process.env.VELLUM_WORKSPACE_DIR || '/workspace';
  const topN = opts.topN || 5;

  let source = opts.source || 'auto';
  if (source === 'auto') {
    if (vellumDetect(workspace)) source = 'vellum';
    else if (claudeSource.detect(opts)) source = 'claude';
    else if (hermesSource.detect(opts)) source = 'hermes';
    else if (openclawSource.detect(opts)) source = 'openclaw';
    else throw new Error('No agent data found (checked Vellum workspace, ~/.claude, ~/.hermes, and ~/.openclaw)');
  }

  let data;
  if (source === 'vellum') data = vellumRead(workspace);
  else if (source === 'claude') data = claudeSource.read(opts);
  else if (source === 'hermes') data = hermesSource.read(opts);
  else if (source === 'openclaw') data = openclawSource.read(opts);
  else throw new Error(`Unknown source: ${source}`);

  const config = loadConfig(path.join(__dirname, '..'));
  const SOURCE_STOPWORDS = {
    claude: ['claude', 'hey', 'thanks', 'now', 'latest'],
    hermes: ['hermes', 'hey', 'thanks', 'now', 'latest'],
    openclaw: ['openclaw', 'hey', 'thanks', 'now', 'latest'],
  };
  const sourceStopwords = SOURCE_STOPWORDS[source] || [];
  const stopwords = new Set([
    ...BASE_STOPWORDS,
    ...sourceStopwords,
    ...(Array.isArray(config.extraStopwords) ? config.extraStopwords.map((w) => String(w).toLowerCase()) : []),
  ]);

  const topics = topTopics(data.titles, stopwords, topN);

  const stats = {
    generatedAt: new Date().toISOString(),
    source,
    conversations: data.conversations,
    realConversations: data.realConversations,
    daysTogether: daysSince(data.firstDate),
    firstConversation: data.firstDate,
    memories: data.memories,
    swears: countSwears(data.userTexts),
    topTopics: topics,
    era: deriveEra(topics),
  };

  /* receipt: token usage (vellum only for now) */
  if (source === 'vellum') {
    try {
      const out = execFileSync('assistant', ['usage', 'totals', '--range', 'all', '--json'], {
        encoding: 'utf8',
        timeout: 15000,
      });
      const u = JSON.parse(out);
      const totalTokens = (u.totalInputTokens || 0) + (u.totalOutputTokens || 0)
        + (u.totalCacheCreationTokens || 0) + (u.totalCacheReadTokens || 0);
      if (totalTokens > 0) {
        stats.receipt = {
          llmCalls: u.eventCount || 0,
          totalTokens,
        };
      }
    } catch { /* usage unavailable — skip receipt */ }
  }

  return stats;
}

function formatSummary(stats) {
  const lines = [
    '── Agent Wrapped ──',
    `Source:          ${stats.source}`,
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
