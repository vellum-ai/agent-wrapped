---
name: assistant-wrapped
description: >-
  Generate an "Assistant Wrapped" year-in-review from real workspace data:
  conversation count, days together, memories formed, swear count, top topics,
  and a derived era. Use when the user asks for their wrapped, a year in
  review, a usage recap, or wants to build or refresh Spotify-Wrapped-style
  share cards from their assistant history.
metadata:
  emoji: "🎁"
  vellum:
    display-name: "Assistant Wrapped"
    category: "fun"
    activation-hints:
      - "User asks for their assistant wrapped or year in review"
      - "User wants a recap of how much they've used their assistant"
      - "User wants Spotify-Wrapped-style share cards from their chat history"
      - "User wants to refresh the data behind their wrapped cards app"
    avoid-when:
      - "User wants analytics about cost or model usage (use cost tooling instead)"
---

# Assistant Wrapped

Turn the assistant's own workspace data into a Spotify-Wrapped-style recap. The plugin ships a collector that scans conversations and memory, plus a CLI and a model tool that expose it.

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
- `--write`: write to `<workspace>/data/apps/assistant-wrapped/src/wrapped-data.json`
- `--out <path>`: write to a custom path

## Building the cards experience

The stats JSON is designed to feed a card-based share UI (one stat per card). Typical flow:

1. Run `wrapped_stats` with `write_path` pointing at the app's `src/wrapped-data.json`.
2. In the app, import the JSON directly (`import data from "./wrapped-data.json"`); esbuild handles JSON imports.
3. Map stats to cards: conversations, days together (show `firstConversation` as "since" label), memories, swears, top topics list, era as the finale card.
4. Rebuild/refresh the app so the new numbers render.

Format numbers with `toLocaleString()` and derive date labels from `firstConversation` rather than hardcoding.

## Tuning

`config.json` at the plugin root supports:

```json
{ "extraStopwords": ["yourname", "yourassistantname"] }
```

Add the user's name, the assistant's name, and company names so they don't dominate topic extraction. This file is user-owned and survives plugin upgrades.
