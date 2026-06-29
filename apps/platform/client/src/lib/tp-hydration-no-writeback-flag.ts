/**
 * Feature flag TP_HYDRATION_NO_WRITEBACK (Промт 3.5).
 * При включении гидрация ТТ заполняет read-overlay (dbTradePoints) без persist в blob.
 */

let cached: boolean | null = null;

export function resetTpHydrationNoWritebackFlagCache(): void {
  cached = null;
}

export function seedTpHydrationNoWritebackFromBootstrap(
  flags: { flags?: { TP_HYDRATION_NO_WRITEBACK?: boolean } },
): void {
  if (flags.flags?.TP_HYDRATION_NO_WRITEBACK === true) cached = true;
  else if (flags.flags?.TP_HYDRATION_NO_WRITEBACK === false) cached = false;
}

export async function shouldUseTpHydrationNoWriteback(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const res = await fetch("/api/config/feature-flags", { credentials: "include" });
    if (!res.ok) {
      cached = false;
      return false;
    }
    const body = (await res.json()) as { flags?: { TP_HYDRATION_NO_WRITEBACK?: boolean } };
    cached = body.flags?.TP_HYDRATION_NO_WRITEBACK === true;
  } catch {
    cached = false;
  }
  return cached;
}

export function getTpHydrationNoWritebackFlagSync(): boolean {
  return cached === true;
}
