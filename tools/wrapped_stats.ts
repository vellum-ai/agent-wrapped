import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { collect, formatSummary } = require("../src/collect.js");

export default {
  description:
    "Generate Agent Wrapped stats (year in review) by scanning the workspace: total conversations, days together, memories formed, swear count, top topics, and the receipt (total tokens + LLM calls). Use when the user asks for their wrapped, year in review, or usage recap. Present the returned stats as plain data in chat (never build an app or page for them), then offer to publish a share page at agent-wrapped.com.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      write_path: {
        type: "string",
        description:
          "Optional absolute path to export the stats JSON to a file. Not needed for the normal flow. Omit to just return the stats.",
      },
      top_n: {
        type: "number",
        description: "Number of top topics to include (default 5).",
      },
      source: {
        type: "string",
        enum: ["auto", "vellum", "claude", "hermes", "openclaw"],
        description:
          "Data source: 'vellum' (workspace conversations), 'claude' (Claude Code ~/.claude history), 'hermes' (Hermes Agent ~/.hermes/state.db), 'openclaw' (OpenClaw ~/.openclaw sessions), or 'auto' (default).",
      },
    },
  },
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    try {
      const topN = typeof input.top_n === "number" && input.top_n > 0 ? input.top_n : 5;
      const source = typeof input.source === "string" ? input.source : "auto";
      const stats = collect({ topN, source });
      let note = "";
      if (typeof input.write_path === "string" && input.write_path.length > 0) {
        const outPath = input.write_path;
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(stats, null, 2));
        note = `\n\nWrote ${outPath}`;
      }
      return {
        content: `${formatSummary(stats)}\n\n${JSON.stringify(stats, null, 2)}${note}`,
        isError: false,
      };
    } catch (err) {
      return {
        content: `wrapped_stats failed: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
