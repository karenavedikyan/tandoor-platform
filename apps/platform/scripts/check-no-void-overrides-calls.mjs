#!/usr/bin/env node
/**
 * CI guard: запрет fire-and-forget overrides API (Промт 113.1 / 113.3).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "client", "src");

const VOID_FORBIDDEN = [
  /void\s+upsertDealerOverride\s*\(/,
  /void\s+upsertTradePointOverride\s*\(/,
  /void\s+setDealerTraining\s*\(/,
  /void\s+setTradePointTraining\s*\(/,
  /void\s+trashDealer\s*\(/,
  /void\s+untrashDealer\s*\(/,
  /void\s+trashTradePoint\s*\(/,
  /void\s+untrashTradePoint\s*\(/,
  /void\s+createManualDealer\s*\(/,
  /void\s+upsertDealerOverrideStrict\s*\(/,
  /void\s+upsertTradePointOverrideStrict\s*\(/,
  /void\s+setDealerTrainingStrict\s*\(/,
  /void\s+setTradePointTrainingStrict\s*\(/,
  /void\s+trashDealerStrict\s*\(/,
  /void\s+untrashDealerStrict\s*\(/,
  /void\s+trashTradePointStrict\s*\(/,
  /void\s+untrashTradePointStrict\s*\(/,
  /void\s+createManualDealerStrict\s*\(/,
];

const STRICT_FN =
  /(?:upsertDealerOverrideStrict|upsertTradePointOverrideStrict|setDealerTrainingStrict|setTradePointTrainingStrict|trashDealerStrict|untrashDealerStrict|trashTradePointStrict|untrashTradePointStrict|createManualDealerStrict)\s*\(/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const hits = [];

const STRICT_CALL_ALLOWLIST = new Set([
  "lib/dealer-overrides-api.ts",
  "lib/trade-point-overrides-api.ts",
  "lib/overrides-pending-sync-worker.ts",
  "lib/use-dealer-field-saver.ts",
]);

for (const file of walk(ROOT)) {
  const rel = file.replace(ROOT + "/", "");
  if (rel.includes("__tests__")) continue;
  const text = readFileSync(file, "utf8");
  for (const re of VOID_FORBIDDEN) {
    if (re.test(text)) {
      hits.push({ file: rel, pattern: re.source });
    }
  }

  if (STRICT_CALL_ALLOWLIST.has(rel)) continue;

  const code = stripComments(text);
  let m;
  STRICT_FN.lastIndex = 0;
  while ((m = STRICT_FN.exec(code)) !== null) {
    const idx = m.index;
    const before = code.slice(Math.max(0, idx - 80), idx);
    if (/\bawait\s+$/.test(before) || /=\s*$/.test(before) || /return\s+$/.test(before)) continue;
    if (/\bvoid\s+$/.test(before)) continue;
    const line = code.slice(0, idx).split("\n").length;
    hits.push({
      file: rel,
      pattern: `strict call without await/assignment at line ~${line}: ${m[0].slice(0, 40)}`,
    });
  }
}

if (hits.length > 0) {
  console.error("Forbidden overrides API usage:\n");
  for (const h of hits) {
    console.error(`  ${h.file}: ${h.pattern}`);
  }
  process.exit(1);
}

console.log("✓ no void overrides API calls in client/src");
