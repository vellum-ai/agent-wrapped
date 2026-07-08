---
description: Generate your Assistant Wrapped — a Spotify-Wrapped-style year in review from your Claude Code history
---

Generate the user's Assistant Wrapped stats by running the bundled collector against their local Claude Code history:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/wrapped.js --source claude
```

Then present the results in a fun, punchy way, one stat at a time like Spotify Wrapped reveal cards: conversations, days together, memories formed, times they swore, top topics, and their era. Keep it playful. React to standout numbers (a zero swear count deserves a comment, so does a huge one).

After presenting, offer two follow-ups:

1. **Get the JSON** — rerun with `--json` and save it wherever they want (`--out <path>` works too).
2. **Publish a share page** — their wrapped can go live at `https://assistant-wrapped.vercel.app/<name>`. To publish: add `assistant` (their assistant's name), `emoji`, and `tagline` fields to the JSON, then open a PR adding it as `pages/<name>.json` to https://github.com/vellum-ai/assistant-wrapped. Once merged, the page is live.

Everything is computed locally from `~/.claude`. Nothing is uploaded unless they choose to publish.
