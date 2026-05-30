#!/usr/bin/env node
/**
 * CI guard: запрет void upsertDealerOverride / void upsertTradePointOverride и т.д. (Промт 113.1)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "client", "src");
const FORBIDDEN = [
  /void\s+upsertDealerOverride\s*\(/,
  /void\s+upsertTradePointOverride\s*\(/,
  /void\s+setDealerTraining\s*\(/,
  /void\s+setTradePointTraining\s*\(/,
  /void\s+trashDealer\s*\(/,
  /void\s+untrashDealer\s*\(/,
  /void\s+trashTradePoint\s*\(/,
  /void\s+untrashTradePoint\s*\(/,
  /void\s+createManualDealer\s*\(/,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      hits.push({ file, pattern: re.source });
    }
  }
}

if (hits.length > 0) {
  console.error("Forbidden void overrides API calls found:\n");
  for (const h of hits) {
    console.error(`  ${h.file}: ${h.pattern}`);
  }
  process.exit(1);
}

console.log("✓ no void overrides API calls in client/src");
