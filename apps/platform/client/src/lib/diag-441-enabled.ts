/** True when hash-query contains diag=1 (441 mobile diagnostics). */
export function isDiag441Enabled(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx < 0) return false;
  return new URLSearchParams(hash.slice(qIdx + 1)).get("diag") === "1";
}
