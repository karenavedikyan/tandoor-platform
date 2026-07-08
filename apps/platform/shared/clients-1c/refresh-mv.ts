import type { PoolLike } from "../../server/db/neon-client.js";

export type RefreshClients1cMvResult = {
  ok: true;
  refreshedAt: string;
  ms: number;
};

export async function refreshClients1cMv(pool: PoolLike): Promise<RefreshClients1cMvResult> {
  const started = Date.now();
  await pool.query("SELECT refresh_clients_1c_mv()");
  return {
    ok: true,
    refreshedAt: new Date().toISOString(),
    ms: Date.now() - started,
  };
}
