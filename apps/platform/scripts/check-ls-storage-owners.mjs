#!/usr/bin/env node
/**
 * CI guard (Промт 114): setItem для ключей маршрутов/порядка выгрузки только в файлах-владельцах.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "client", "src");

const RULES = [
  {
    key: "tandoor-dealer-shipment-route-defs-v1",
    owners: ["lib/dealer-shipment-route-definitions.ts"],
  },
  {
    key: "tandoor-dealer-unloading-order-v1",
    owners: ["lib/dealer-unloading-order-storage.ts"],
  },
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
  const rel = file.replace(ROOT + "/", "");
  if (rel.includes("__tests__")) continue;
  const text = readFileSync(file, "utf8");
  for (const rule of RULES) {
    if (!text.includes(rule.key)) continue;
    if (!text.includes("localStorage.setItem") && !text.includes("setItem(")) continue;
    if (!text.includes(rule.key)) continue;
    const isOwner = rule.owners.some((o) => rel === o || rel.endsWith(o));
    if (isOwner) continue;
    if (text.includes(`setItem(${rule.key}`) || text.includes(`setItem("${rule.key}"`) || text.includes(`'${rule.key}'`)) {
      hits.push({ rel, key: rule.key, owners: rule.owners });
    }
  }
}

if (hits.length > 0) {
  console.error("check-ls-storage-owners: forbidden localStorage.setItem for protected keys:\n");
  for (const h of hits) {
    console.error(`  ${h.rel} → ${h.key} (only: ${h.owners.join(", ")})`);
  }
  process.exit(1);
}

console.log("✓ LS storage owner checks OK");
