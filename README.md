# Agent Wrapped 🎁

Your agent's year in review, computed from real local data. Works with **Vellum agents** and **Claude Code**. No estimates, no vibes, just your actual history:

- **Conversations** — every conversation you've ever had
- **Days together** — since your very first conversation
- **Memories formed** — concepts your agent has saved about you
- **Times you swore** — a regex does not lie
- **Top topics** — bigram-weighted analysis of conversation titles
- **Your era** — derived from your #1 topic ("release" → *The shipping era*)

## Install

**Vellum:**

```
assistant plugins install vellum-ai/agent-wrapped
```

**Claude Code:**

```
/plugin marketplace add vellum-ai/agent-wrapped
/plugin install agent-wrapped@agent-wrapped
```

Then run `/wrapped` in any Claude Code session.

## How to use

Once installed, just ask your assistant. Any of these work:

> "Show me my agent wrapped"

> "Give me my year in review"

> "How much have we actually talked? Build my wrapped"

Your assistant runs the stats collector against your real history and presents the results: conversations, days together, memories, swear count, top topics, and your era.

Want the shareable card page? Follow up with:

> "Publish my wrapped as a share page, name it `<yourname>`"

Your assistant will show you exactly what gets published and ask for confirmation first. Nothing goes public without your explicit yes. The page lands at `agent-wrapped.com/<yourname>`.

On Claude Code, skip the prompts entirely and run `/wrapped`.

**Hermes Agent:**

```
git clone https://github.com/vellum-ai/agent-wrapped
node agent-wrapped/bin/wrapped.js --source hermes
```

Reads `~/.hermes/state.db` (set `--hermes-dir` or `HERMES_HOME` to override). Needs Node 22.5+ or Bun for SQLite support.

**OpenClaw:**

```
git clone https://github.com/vellum-ai/agent-wrapped
node agent-wrapped/bin/wrapped.js --source openclaw
```

Reads `~/.openclaw` session transcripts and MEMORY.md (set `--openclaw-dir` or `OPENCLAW_HOME` to override). Subagent sessions don't count as conversations.

## What it ships

| Surface | What it does |
| ------- | ------------ |
| `wrapped_stats` tool | Model-callable stats collector; optional `write_path` to persist the JSON |
| `agent-wrapped` skill | Teaches the agent how to generate stats and build the share-card experience |
| `bin/wrapped.js` CLI | Manual runs: `--json`, `--write`, `--out <path>`, `--source vellum|claude|hermes|openclaw` |
| `/wrapped` command | Claude Code slash command: generate + present your wrapped |

## CLI usage

```
node bin/wrapped.js                    # human summary (auto-detects source)
node bin/wrapped.js --json             # JSON to stdout
node bin/wrapped.js --source claude    # force Claude Code history (~/.claude)
node bin/wrapped.js --out /tmp/wrapped.json
```

## Configuration

Add names that shouldn't count as "topics" (yours, your agent's, your company's) to `config.json` at the plugin root:

```json
{ "extraStopwords": ["alex", "aria", "acme"] }
```

`config.json` is user-owned and preserved across plugin upgrades.

## Privacy

Everything runs locally against your own workspace. Nothing is uploaded, nothing leaves the machine. The output is a single JSON blob you control.

## Share pages

Publish your wrapped at `https://agent-wrapped.com/<name>` — two ways:

**Direct (instant, no GitHub needed):**

```
node bin/publish.js --name myassistant --push --yes
```

**Via PR (reviewed before going live):**

```
node bin/publish.js --name myassistant --assistant "My Assistant" --emoji "🤖" --tagline "chaos, but organized"
```

This forks the repo, commits `pages/<name>.json`, and opens a PR. Merged = live.

## License

MIT
