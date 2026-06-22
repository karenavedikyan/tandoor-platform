const SS_KEY = "diag441";

/** True when hash-query contains diag=1, OR it was enabled earlier in this session. */
export function isDiag441Enabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(SS_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  const hash = window.location.hash;
  const qIdx = hash.indexOf("?");
  const enabled = qIdx >= 0 && new URLSearchParams(hash.slice(qIdx + 1)).get("diag") === "1";
  if (enabled) {
    try {
      window.sessionStorage.setItem(SS_KEY, "1");
    } catch {
      /* ignore */
    }
  }
  return enabled;
}
