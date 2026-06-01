/** @typedef {'neon' | 'yandex'} DbKind */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

export function normUuid(v) {
  const t = String(v ?? "").trim();
  return isUuid(t) ? t.toLowerCase() : null;
}

export function normPath(p) {
  return String(p ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

export function escSqlLiteral(s) {
  return `'${String(s ?? "").replace(/'/g, "''")}'`;
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function parseTargetDb(raw) {
  const v = String(raw ?? "both").trim().toLowerCase();
  if (v === "neon" || v === "yandex" || v === "both") return v;
  return "both";
}

export function targetsFromEnv() {
  return parseTargetDb(process.env.TARGET_DB);
}

export function logLine(msg) {
  const ts = new Date().toISOString();
  console.log(`[sync-1c-catalog] ${ts} ${msg}`);
}
