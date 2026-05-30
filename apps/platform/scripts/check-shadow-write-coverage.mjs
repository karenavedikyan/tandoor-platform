#!/usr/bin/env node
/**
 * CI guard: прямой neon() без wrapNeonWithShadow / makePoolFromNeon запрещён
 * (кроме явно разрешённых migration/OG файлов).
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM = path.resolve(ROOT, "..");

const ALLOWED_PREFIXES = [
  "server/db/neon-client.ts",
  "server/db/pg-client.ts",
  "shared/dual-db-migrate.ts",
  "shared/marketing-brief-og.ts",
  "server/db-migrate/",
];

function isAllowedFile(filePath) {
  const normalized = filePath.replace(/^\.\//, "");
  return ALLOWED_PREFIXES.some((p) => normalized === p || normalized.startsWith(p));
}

function isBenignLine(content) {
  if (content.includes("wrapNeonWithShadow") || content.includes("makePoolFromNeon")) return true;
  if (/^\s*import\s/.test(content)) return true;
  if (/^\s*\/\//.test(content) || /^\s*\*/.test(content)) return true;
  if (/['"`].*neon\s*\(/.test(content)) return true;
  return false;
}

let out = "";
try {
  out = execSync(`grep -rn "neon(" --include="*.ts" --include="*.tsx" .`, {
    encoding: "utf8",
    cwd: PLATFORM,
  });
} catch (e) {
  const err = e;
  if (err.status === 1) {
    console.log("✓ shadow-write coverage OK");
    process.exit(0);
  }
  throw e;
}

const offenders = out
  .split("\n")
  .filter(Boolean)
  .filter((line) => {
    const match = line.match(/^\.\/([^:]+):(\d+):(.*)$/);
    if (!match) return true;
    const [, file, , content] = match;
    if (isAllowedFile(file)) return false;
    if (isBenignLine(content)) return false;
    return true;
  });

if (offenders.length > 0) {
  console.error("Найдены прямые вызовы neon() без shadow-write обёртки:");
  for (const l of offenders) console.error("  " + l);
  console.error("\nИспользуй wrapNeonWithShadow(neon(url), 'tag') или makePoolFromNeon(neon(url)).");
  process.exit(1);
}

console.log("✓ shadow-write coverage OK");
