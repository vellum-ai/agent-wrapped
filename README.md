# Assistant Wrapped 🎁

Spotify-Wrapped-style year-in-review for your AI assistant, computed from real local data. Works with **Vellum assistants** and **Claude Code**. No estimates, no vibes, just your actual history:

- **Conversations** — every conversation you've ever had
- **Days together** — since your very first conversation
- **Memories formed** — concepts your assistant has saved about you
- **Times you swore** — a regex does not lie
- **Top topics** — bigram-weighted analysis of conversation titles
- **Your era** — derived from your #1 topic ("release" → *The shipping era*)

## Install

**Vellum:**

```
assistant plugins install vellum-ai/assistant-wrapped
```

**Claude Code:**

```
/plugin marketplace add vellum-ai/assistant-wrapped
/plugin install assistant-wrapped@assistant-wrapped
```

Then run `/wrapped` in any Claude Code session.

## What it ships

| Surface | What it does |
| ------- | ------------ |
| `wrapped_stats` tool | Model-callable stats collector; optional `write_path` to persist the JSON |
| `assistant-wrapped` skill | Teaches the assistant how to generate stats and build the share-card experience |
| `bin/wrapped.js` CLI | Manual runs: `--json`, `--write`, `--out <path>`, `--source vellum|claude` |
| `/wrapped` command | Claude Code slash command: generate + present your wrapped |

## CLI usage

```
node bin/wrapped.js                    # human summary (auto-detects source)
node bin/wrapped.js --json             # JSON to stdout
node bin/wrapped.js --source claude    # force Claude Code history (~/.claude)
node bin/wrapped.js --out /tmp/wrapped.json
```

## Configuration

Add names that shouldn't count as "topics" (yours, your assistant's, your company's) to `config.json` at the plugin root:

```json
{ "extraStopwords": ["alex", "aria", "acme"] }
```

`config.json` is user-owned and preserved across plugin upgrades.

## Privacy

Everything runs locally against your own workspace. Nothing is uploaded, nothing leaves the machine. The output is a single JSON blob you control.

## Share pages

Publish your wrapped at `https://assistant-wrapped.vercel.app/<name>` with one command:

```
node bin/publish.js --name myassistant --assistant "My Assistant" --emoji "🤖" --tagline "chaos, but organized"
```

It shows you exactly what will be uploaded and asks before doing anything. Then it forks this repo (using your `gh` login or `GITHUB_TOKEN`), commits `pages/<name>.json`, and opens a PR. Merged = live. Prefer doing it by hand? Just PR the JSON into `pages/` yourself.

## License

MIT
