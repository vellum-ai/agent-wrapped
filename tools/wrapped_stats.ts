import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { collect, formatSummary } = require("../src/collect.js");

export default {
  description:
    "Generate Assistant Wrapped stats (Spotify-Wrapped-style year in review) by scanning the workspace: total conversations, days together, memories formed, swear count, top topics, and the derived era. Use when the user asks for their wrapped, year in review, usage recap, or to refresh the wrapped cards app data. Optionally writes the stats JSON to a file (e.g. the wrapped cards app's src/wrapped-data.json).",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      write_path: {
        type: "string",
        description:
          "Optional absolute path to write the stats JSON to (e.g. the wrapped cards app's src/wrapped-data.json). Omit to just return the stats.",
      },
      top_n: {
        type: "number",
        description: "Number of top topics to include (default 5).",
      },
      source: {
        type: "string",
        enum: ["auto", "vellum", "claude"],
        description:
          "Data source: 'vellum' (workspace conversations), 'claude' (Claude Code ~/.claude history), or 'auto' (default).",
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
