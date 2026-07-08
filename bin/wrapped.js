#!/usr/bin/env node
/**
 * wrapped — Assistant Wrapped data collector CLI
 *
 * Usage:
 *   wrapped                 collect stats and print a human summary
 *   wrapped --json          print stats as JSON
 *   wrapped --write         write stats to the wrapped cards app (src/wrapped-data.json)
 *   wrapped --out <path>    write stats JSON to a custom path
 */

const fs = require('fs');
const path = require('path');
const { collect, formatSummary } = require('../src/collect.js');

const WORKSPACE = process.env.VELLUM_WORKSPACE_DIR || '/workspace';
const DEFAULT_APP_OUT = path.join(WORKSPACE, 'data', 'apps', 'assistant-wrapped', 'src', 'wrapped-data.json');

const args = process.argv.slice(2);
const stats = collect({ workspace: WORKSPACE });

if (args.includes('--json')) {
  console.log(JSON.stringify(stats, null, 2));
} else {
  console.log(formatSummary(stats));
}

let outPath = null;
if (args.includes('--write')) outPath = DEFAULT_APP_OUT;
const outFlag = args.indexOf('--out');
if (outFlag !== -1 && args[outFlag + 1]) outPath = args[outFlag + 1];

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(stats, null, 2));
  console.log(`\nWrote ${outPath}`);
}
