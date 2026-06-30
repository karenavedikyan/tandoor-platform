#!/usr/bin/env node
/**
 * BFS по value-импортам от dealer-base: seed не должен быть достижим.
 * Запуск: npm run check:seed-offcritical
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_SRC = join(ROOT, "client", "src");
const SEED_MARKER = "tandoor-real-catalog-seed.generated";
const ENTRY = join(CLIENT_SRC, "pages", "dealer-base.tsx");

const IMPORT_FROM_RE =
  /(?:^|\n)\s*import\s+(?!type\b)(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const EXPORT_FROM_RE = /(?:^|\n)\s*export\s+(?:\*|{[^}]*})\s+from\s+['"]([^'"]+)['"]/g;

function stripTypeOnlyImports(source) {
  return source.replace(/^\s*import\s+type\s+[^;]+;?\s*$/gm, "");
}

function resolveModule(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) {
    base = join(CLIENT_SRC, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = resolve(dirname(fromFile), spec);
  } else {
    return null;
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function collectSpecs(filePath) {
  const source = stripTypeOnlyImports(readFileSync(filePath, "utf8"));
  const specs = new Set();
  for (const re of [IMPORT_FROM_RE, EXPORT_FROM_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) {
      specs.add(m[1]);
    }
  }
  return [...specs];
}

function traceReachableSeed() {
  const queue = [ENTRY];
  const seen = new Set([ENTRY]);
  const chain = new Map([[ENTRY, null]]);

  while (queue.length > 0) {
    const file = queue.shift();
    if (file.includes(SEED_MARKER)) {
      const path = [];
      let cur = file;
      while (cur) {
        path.unshift(cur.replace(CLIENT_SRC + "/", ""));
        cur = chain.get(cur);
      }
      return path;
    }

    for (const spec of collectSpecs(file)) {
      const resolved = resolveModule(file, spec);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);
      chain.set(resolved, file);
      queue.push(resolved);
    }
  }
  return null;
}

const hit = traceReachableSeed();
if (hit) {
  console.error("tandoor-real-catalog-seed is reachable from dealer-base:");
  for (const step of hit) {
    console.error(`  -> ${step}`);
  }
  process.exit(1);
}

console.log("check:seed-offcritical: ok");
