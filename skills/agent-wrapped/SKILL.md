---
name: agent-wrapped
description: >-
  Generate an "Agent Wrapped" year-in-review from real workspace data:
  conversation count, days together, memories formed, swear count, top topics,
  and a derived era. Use when the user asks for their wrapped, a year in
  review, a usage recap, or wants to build or refresh wrapped
  share cards from their agent history.
metadata:
  emoji: "🎁"
  vellum:
    display-name: "Agent Wrapped"
    category: "fun"
    activation-hints:
      - "User asks for their agent wrapped, assistant wrapped, or year in review"
      - "User wants a recap of how much they've used their agent"
      - "User wants wrapped-style share cards from their chat history"
      - "User wants to refresh the data behind their wrapped cards app"
    avoid-when:
      - "User wants analytics about cost or model usage (use cost tooling instead)"
---

# Agent Wrapped

Turn the agent's own workspace data into a wrapped-style recap. The plugin ships a collector that scans conversations and memory, plus a CLI and a model tool that expose it.

## What gets measured

| Stat            | Source                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| Conversations   | Directory count under `<workspace>/conversations/`                              |
| Days together   | Days since the earliest conversation directory date                              |
| Memories formed | `.md` files under `<workspace>/memory/concepts/`                                |
| Times sworn     | Regex over user messages in every `messages.jsonl`                              |
| Top topics      | Bigram-weighted frequency analysis of conversation titles (standard convos only) |
| Era             | Derived from the #1 topic via a fun mapping ("release" → "The shipping era")    |

Background and scheduled conversations (`meta.type !== "standard"`) are excluded from topic analysis so cron noise never becomes a "top topic."

## Two ways to run it

**1. The `wrapped_stats` tool (preferred).** Call it directly; pass `write_path` to also write the stats JSON somewhere (typically a cards app's `src/wrapped-data.json`). Pass `top_n` to change how many topics come back.

**2. The CLI.** `node <plugin-dir>/bin/wrapped.js` with flags:

- no flags: human-readable summary
- `--json`: JSON to stdout
- `--write`: write to `<workspace>/data/apps/agent-wrapped/src/wrapped-data.json`
- `--out <path>`: write to a custom path
- `--source vellum|claude|hermes|auto`: pick the data source (default auto-detect)
- `--claude-dir <path>`: override the Claude Code config dir (default `~/.claude`)

## Sources

- **vellum** (default when a workspace is present): conversations/ + memory/concepts/
- **claude**: Claude Code session history at `~/.claude/projects/*/*.jsonl`. Sessions map to conversations, first human prompt per session feeds topic analysis, memories count entries in the global `CLAUDE.md`. The tool accepts a `source` input too.

## Building the cards experience

The stats JSON is designed to feed a card-based share UI (one stat per card). Typical flow:

1. Run `wrapped_stats` with `write_path` pointing at the app's `src/wrapped-data.json`.
2. In the app, import the JSON directly (`import data from "./wrapped-data.json"`); esbuild handles JSON imports.
3. Map stats to cards: conversations, days together (show `firstConversation` as "since" label), memories, swears, top topics list, era as the finale card.
4. Rebuild/refresh the app so the new numbers render.

Format numbers with `toLocaleString()` and derive date labels from `firstConversation` rather than hardcoding.

## Publishing a share page

Wrapped pages go live at `https://agent-wrapped.vercel.app/<name>`. Publishing uploads the stats JSON to the public GitHub repo, so **always ask the user for explicit consent first** — never publish on your own initiative. If they agree, run:

```
node <plugin-dir>/bin/publish.js --name <name> --assistant "<Display Name>" --emoji "<emoji>" --tagline "<one-liner>" [--file <stats.json>] [--yes]
```

The script prints the exact JSON that will be published and asks for confirmation (skip the interactive prompt with `--yes` only after the user already confirmed in chat). It needs GitHub auth: a logged-in `gh` CLI or a `GITHUB_TOKEN` env var. It forks vellum-ai/agent-wrapped, commits `pages/<name>.json` on a branch, and opens a PR. Merged PR = page live, no redeploy needed.

## Tuning

`config.json` at the plugin root supports:

```json
{ "extraStopwords": ["yourname", "yourassistantname"] }
```

Add the user's name, the assistant's name, and company names so they don't dominate topic extraction. This file is user-owned and survives plugin upgrades.
