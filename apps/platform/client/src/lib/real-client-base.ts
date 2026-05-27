import { getReleaseClients, type ReleaseClient } from "@/lib/release-client-data";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";

export type ClientAssignmentLite = {
  code: string;
  responsibleUserId: string | null;
  teamId: string | null;
};

export function buildAssignmentsMap(
  assignments: ClientAssignmentLite[] | null | undefined,
): ReadonlyMap<string, { responsibleUserId: string | null; teamId: string | null }> {
  const m = new Map<string, { responsibleUserId: string | null; teamId: string | null }>();
  for (const a of assignments ?? []) {
    if (!a.code) continue;
    m.set(a.code, { responsibleUserId: a.responsibleUserId, teamId: a.teamId });
  }
  return m;
}

/**
 * Клиенты из сида, видимые текущему пользователю.
 *
 * Промт 53: НЕ подставляем UUID `responsibleUserId`/`teamId` из `client_assignments`
 * поверх каталожных `mgr-*` / `team-*` идентификаторов. Downstream-фильтры
 * (`roleScopedDealerRows`, `applyDealerBasePickerFilters`) сравнивают
 * `releaseManagerId === u.id` (`mgr-kulakova-os`) и `releaseTeamId === tid`
 * (`team-skalaban`). Подстановка UUID ломала эти сравнения и приводила к
 * пустому списку (0/3 клиентов вместо 244). Если в будущем понадобится
 * отражать переназначения из БД — для этого нужен полноценный маппер
 * UUID → catalog-key через `OrgSnapshot`, который сейчас отсутствует.
 *
 * Параметр `_assignments` оставлен в сигнатуре для совместимости с
 * call-sites (`dealer-base.tsx`, `release-clients.tsx`, `trade-points.tsx`);
 * внутри функции он больше не используется. `snap` тоже остаётся
 * параметром-плейсхолдером для будущей интеграции через OrgSnapshot.
 */
export function getVisibleReleaseClients(
  _snap: OrgSnapshot,
  all: boolean,
  codes: string[] | null,
  _assignments: ReadonlyMap<string, { responsibleUserId: string | null; teamId: string | null }> | null,
): ReleaseClient[] {
  const allRows = getReleaseClients();
  return all || codes === null ? allRows : allRows.filter((c) => codes.includes(c.code));
}
