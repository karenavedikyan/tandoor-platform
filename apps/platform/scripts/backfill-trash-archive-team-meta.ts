/**
 * Промт 398: backfill ownerTeamAtTrash / ownerTeamAtArchive / ownerCode в jsonb-state.
 *
 * Запуск: `npx tsx scripts/backfill-trash-archive-team-meta.ts` из apps/platform.
 *
 * Ограничение: ownerTeam* = текущая команда trashedBy/archivedBy на момент backfill.
 */
import { neon } from "@neondatabase/serverless";

function resolveDatabaseUrl(): string | null {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.NEON_DATABASE_URL?.trim() ||
    null
  );
}

type TrashRec = Record<string, unknown>;
type State = Record<string, unknown>;

async function main(): Promise<void> {
  const url = resolveDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const sql = neon(url);

  const teamByUser = new Map<string, string | null>();
  const users = await sql`
    SELECT u.id::text AS id, utm.team_id::text AS team_id
    FROM users u
    LEFT JOIN user_team_memberships utm ON utm.user_id = u.id
  `;
  for (const row of users) {
    const id = String(row.id);
    if (!teamByUser.has(id) && row.team_id) teamByUser.set(id, String(row.team_id));
    if (!teamByUser.has(id)) teamByUser.set(id, row.team_id ? String(row.team_id) : null);
  }

  const rows = await sql`
    SELECT scope_key, state FROM client_base_actualization_state
  `;

  let updated = 0;
  for (const row of rows) {
    const state = row.state as State;
    if (!state || typeof state !== "object") continue;
    let changed = false;

    const patchTrash = (map: Record<string, TrashRec> | undefined) => {
      if (!map) return;
      for (const [id, rec] of Object.entries(map)) {
        if (!rec || typeof rec !== "object") continue;
        const by = typeof rec.trashedBy === "string" ? rec.trashedBy : null;
        if (!rec.ownerTeamAtTrash && by) {
          rec.ownerTeamAtTrash = teamByUser.get(by) ?? null;
          changed = true;
        }
        if (!rec.ownerCode) {
          const snap = rec.snapshot as { dealerCode?: string } | undefined;
          rec.ownerCode = snap?.dealerCode ?? (id.replace(/^client-/i, "").toUpperCase() || null);
          changed = true;
        }
      }
    };

    const patchArchive = (map: Record<string, TrashRec> | undefined) => {
      if (!map) return;
      for (const [id, rec] of Object.entries(map)) {
        if (!rec || typeof rec !== "object") continue;
        const by = typeof rec.archivedBy === "string" ? rec.archivedBy : null;
        if (!rec.ownerTeamAtArchive && by) {
          rec.ownerTeamAtArchive = teamByUser.get(by) ?? null;
          changed = true;
        }
        if (!rec.ownerCode) {
          rec.ownerCode = id.replace(/^client-/i, "").toUpperCase() || null;
          changed = true;
        }
      }
    };

    patchTrash(state.trashedDealersById as Record<string, TrashRec>);
    patchTrash(state.trashedTradePointsById as Record<string, TrashRec>);
    patchArchive(state.archivedDealersById as Record<string, TrashRec>);
    patchArchive(state.archivedTradePointsById as Record<string, TrashRec>);

    if (changed) {
      await sql`
        UPDATE client_base_actualization_state
        SET state = ${JSON.stringify(state)}::jsonb, updated_at = now()
        WHERE scope_key = ${row.scope_key}
      `;
      updated += 1;
    }
  }

  console.log(`backfill-trash-archive-team-meta: updated ${updated} scope rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
