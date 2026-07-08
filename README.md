# Assistant Wrapped 🎁

Spotify-Wrapped-style year-in-review for your Vellum assistant, computed from real workspace data. No estimates, no vibes, just your actual history:

- **Conversations** — every conversation you've ever had
- **Days together** — since your very first conversation
- **Memories formed** — concepts your assistant has saved about you
- **Times you swore** — a regex does not lie
- **Top topics** — bigram-weighted analysis of conversation titles
- **Your era** — derived from your #1 topic ("release" → *The shipping era*)

## Install

```
assistant plugins install assistant-wrapped
```

Or straight from GitHub:

```
assistant plugins install vellum-ai/assistant-wrapped
```

## What it ships

| Surface | What it does |
| ------- | ------------ |
| `wrapped_stats` tool | Model-callable stats collector; optional `write_path` to persist the JSON |
| `assistant-wrapped` skill | Teaches the assistant how to generate stats and build the share-card experience |
| `bin/wrapped.js` CLI | Manual runs: `--json`, `--write`, `--out <path>` |

## CLI usage

```
node bin/wrapped.js            # human summary
node bin/wrapped.js --json     # JSON to stdout
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

## License

MIT
