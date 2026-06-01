export type CatalogRunnerTarget = "both" | "neon" | "yandex";

export function buildNeonExtraEnv(target: CatalogRunnerTarget): Record<string, string> {
  const extraEnv: Record<string, string> = {};
  if (target === "both" || target === "neon") {
    const neonUrl =
      process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.POSTGRES_URL_NON_POOLING?.trim();
    if (neonUrl) extraEnv.DATABASE_URL_UNPOOLED = neonUrl;
  }
  return extraEnv;
}

export async function callRunner(
  path: "/run/catalog" | "/run/photos",
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const runnerUrl = process.env.SYNC_1C_RUNNER_URL?.trim()?.replace(/\/$/, "");
  if (!runnerUrl) {
    return { ok: false, status: 503, json: { code: "RUNNER_NOT_CONFIGURED" } };
  }

  const token = process.env.SYNC_RUNNER_TOKEN?.trim() ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(`${runnerUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, json };
}
