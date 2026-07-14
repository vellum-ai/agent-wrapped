---
description: Generate your Agent Wrapped — a year in review from your Claude Code history
---

Generate the user's Agent Wrapped stats by running the bundled collector against their local Claude Code history:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/wrapped.js --source claude
```

Then present the results in a fun, punchy way, one stat at a time like reveal cards: conversations, days together, memories formed, times they swore, top topics, and the receipt (total tokens + LLM calls). Keep it playful. React to standout numbers (a zero swear count deserves a comment, so does a huge one).

After presenting, offer two follow-ups:

1. **Get the JSON** — rerun with `--json` and save it wherever they want (`--out <path>` works too).
2. **Publish a share page** — their wrapped can go live at `https://agent-wrapped.com/<name>`. IMPORTANT: always ask the user explicitly before publishing anything — this uploads their stats to a public GitHub repo. If (and only if) they say yes, run the bundled publisher with `--push` for instant publishing (no GitHub auth needed):

```
node ${CLAUDE_PLUGIN_ROOT}/bin/publish.js --name <name> --push --yes
```

Add `--assistant "<Display Name>"`, `--emoji "<emoji>"`, and `--tagline "<one-liner>"` to customize. The page is live immediately at agent-wrapped.com/<name>. If they decline, that's the end of it — don't re-offer in the same session.

Everything is computed locally from `~/.claude`. Nothing is uploaded unless they choose to publish.
