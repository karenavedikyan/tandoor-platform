#!/usr/bin/env node
/**
 * Промт 423: grep-стопы против регрессий DB source of truth в client/src.
 * Анализирует git diff origin/main...HEAD в apps/platform/client/src/ (кроме __tests__/).
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const CLIENT_SRC = "apps/platform/client/src";

const RULES = [
  {
    name: "rows.reduce(...outlets",
    pattern: /rows\.reduce\s*\([^)]*outlets/i,
  },
  {
    name: "rows.filter(...status.*active.*).length",
    pattern: /rows\.filter\s*\([^)]*status[^)]*active[^)]*\)\.length/i,
  },
  {
    name: "actualizationState.trashedDealersById",
    pattern: /actualizationState\.trashedDealersById/,
  },
  {
    name: "OrgSnapshot.*.length with Counter/Count/outlets/total",
    pattern: /OrgSnapshot[^;\n]{0,200}\.length[^;\n]{0,80}(Counter|Count|outlets|total)/i,
  },
];

function getDiff() {
  try {
    return execSync("git diff --unified=0 origin/main HEAD -- " + CLIENT_SRC, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    const err = e;
    if (err && typeof err === "object" && "stdout" in err && typeof err.stdout === "string") {
      return err.stdout;
    }
    return "";
  }
}

function addedLinesFromDiff(diff) {
  const out = [];
  let currentFile = "";
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ b/")) {
      currentFile = raw.slice("+++ b/".length);
      continue;
    }
    if (!currentFile || currentFile.includes("/__tests__/")) continue;
    if (!raw.startsWith("+") || raw.startsWith("+++")) continue;
    out.push({ file: currentFile, line: raw.slice(1) });
  }
  return out;
}

const diff = getDiff();
const added = addedLinesFromDiff(diff);
const violations = [];

for (const { file, line } of added) {
  for (const rule of RULES) {
    if (rule.pattern.test(line)) {
      violations.push(`${rule.name} in ${file}: ${line.trim().slice(0, 120)}`);
    }
  }
}

if (violations.length > 0) {
  console.error("lint:db-source-of-truth FAILED:\n");
  for (const v of violations) console.error("  -", v);
  process.exit(1);
}

console.log("lint:db-source-of-truth OK (no forbidden patterns in diff)");
