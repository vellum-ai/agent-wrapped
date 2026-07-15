---
name: agent-wrapped
description: >-
  Generate an "Agent Wrapped" year-in-review from real workspace data:
  conversation count, days together, memories formed, swear count, top topics,
  and the receipt (total tokens + LLM calls). Use when the user asks for
  their wrapped, a year in review, or a usage recap. Present the stats as
  plain data in chat, then offer to publish a share page at agent-wrapped.com.
metadata:
  emoji: "🎁"
  vellum:
    display-name: "Agent Wrapped"
    category: "fun"
    activation-hints:
      - "User asks for their agent wrapped, assistant wrapped, or year in review"
      - "User wants a recap of how much they've used their agent"
      - "User wants to publish or share their agent's wrapped page"
    avoid-when:
      - "User wants analytics about cost or model usage (use cost tooling instead)"
      - "Never activate app-builder or any page-building flow for wrapped stats"
---

# Agent Wrapped

Turn the agent's own workspace data into a wrapped-style recap. The plugin ships a collector that scans conversations and memory, plus a CLI and a model tool that expose it.

## The flow

Three steps, in order. Do not skip ahead and do not add steps.

1. **Gather.** Call the `wrapped_stats` tool (or run the CLI). No `write_path` needed.
2. **Present as data.** Show the stats directly in the chat as formatted text: conversations, days together, memories, swears, top topics, and the receipt. The chat message IS the presentation. **Do not build anything visual.** No apps, no app-builder, no standalone HTML pages, no dashboards, no dynamic pages, no card UIs of any kind.
3. **Offer to publish.** Ask the user if they want their wrapped live at `agent-wrapped.com/<name>`. If yes, run the publish script (see "Publishing a share page" below) and hand back the live URL. The published page is the whole visual experience: cards, animations, share buttons. There is nothing for you to build.

**HARD RULE: never build a UI for wrapped stats.** The only visual surface for a wrapped is the published agent-wrapped.com page. If the user asks for something visual, that IS the publish flow, so ask for consent and publish.

## What gets measured

| Stat            | Source                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| Conversations   | Directory count under `<workspace>/conversations/`                              |
| Days together   | Days since the earliest conversation directory date                              |
| Memories formed | `.md` files under `<workspace>/memory/concepts/`                                |
| Times sworn     | Regex over user messages in every `messages.jsonl`                              |
| Top topics      | Bigram-weighted frequency analysis of conversation titles (standard convos only) |
| Receipt         | Total tokens + LLM calls from usage data (vellum: `assistant usage totals`; claude: JSONL token sums; hermes: state.db; openclaw: transcript lines) |

Background and scheduled conversations (`meta.type !== "standard"`) are excluded from topic analysis so cron noise never becomes a "top topic."

## Two ways to run it

**1. The `wrapped_stats` tool (preferred).** Call it directly. Pass `top_n` to change how many topics come back. `write_path` exists for exporting the JSON to a file but is not needed for the normal flow.

**2. The CLI.** `node <plugin-dir>/bin/wrapped.js` with flags:

- no flags: human-readable summary
- `--json`: JSON to stdout
- `--write`: write to `<workspace>/data/apps/agent-wrapped/src/wrapped-data.json`
- `--out <path>`: write to a custom path
- `--source vellum|claude|hermes|openclaw|auto`: pick the data source (default auto-detect)
- `--claude-dir <path>`: override the Claude Code config dir (default `~/.claude`)

## Sources

- **vellum** (default when a workspace is present): conversations/ + memory/concepts/
- **claude**: Claude Code session history at `~/.claude/projects/*/*.jsonl`. Sessions map to conversations, first human prompt per session feeds topic analysis, memories count entries in the global `CLAUDE.md`. The tool accepts a `source` input too.

## Presenting the stats

Present the stats in chat as plain formatted text or a simple list. Format numbers with `toLocaleString()`. Suggested order: conversations, days together (with `firstConversation` as a "since" label), memories, swears, top topics, then the receipt (total tokens + LLM calls) as the finale.

Do not build a UI for this. The share page at agent-wrapped.com already renders the full card experience for published wrappeds.

## Publishing a share page

Wrapped pages go live at `https://agent-wrapped.com/<name>`. Publishing uploads the stats JSON to the public GitHub repo, so **always ask the user for explicit consent first**. Never publish on your own initiative.

**Choosing the page slug (`--name`):** Use the **assistant's name**, not the user's name. This is the assistant's wrapped, so the URL should reflect who the assistant is. For example, if the assistant is named Ziggy and the user is Marina, use `--name ziggy`, not `--name marina`. If the slug is already taken, the server auto-increments (e.g. `ziggy-1`, `ziggy-2`) and returns the actual URL.

**Direct publish (recommended, instant, no GitHub auth needed):**

```
node <plugin-dir>/bin/publish.js --name <name> --push --yes
```

Add `--assistant "<Display Name>"`, `--emoji "<emoji>"`, and `--tagline "<one-liner>"` to customize the page. The script POSTs to agent-wrapped.com/api/publish, which commits directly to main. Page is live immediately.

**Via PR (reviewed before going live):**

```
node <plugin-dir>/bin/publish.js --name <name> --assistant "<Display Name>" --emoji "<emoji>" --tagline "<one-liner>" [--file <stats.json>] [--yes]
```

This forks vellum-ai/agent-wrapped, commits `pages/<name>.json` on a branch, and opens a PR. Needs GitHub auth (`gh` CLI or `GITHUB_TOKEN`). Merged PR = page live.

Both modes print the exact JSON that will be published and ask for confirmation (skip with `--yes` only after the user already confirmed in chat).

## Deleting a share page

If the user wants to remove their page, use `--delete`. Same consent rule applies: **ask the user for explicit confirmation first**.

**Direct delete (recommended, instant, no GitHub auth needed):**

```
node <plugin-dir>/bin/publish.js --name <name> --delete --push --yes
```

This POSTs to agent-wrapped.com/api/delete, which removes `pages/<name>.json` from main. Page is gone immediately.

**Via PR (reviewed before removal):**

```
node <plugin-dir>/bin/publish.js --name <name> --delete --yes
```

This forks the repo, deletes the file on a branch, and opens a PR. Needs GitHub auth. Merged PR = page gone.

## Tuning

`config.json` at the plugin root supports:

```json
{ "extraStopwords": ["yourname", "yourassistantname"] }
```

Add the user's name, the assistant's name, and company names so they don't dominate topic extraction. This file is user-owned and survives plugin upgrades.
