/**
 * Запуск: `npm run test:sidebar-counters` из каталога apps/platform.
 *
 * Промт 354: счётчики сайдбара для regional_manager — личный scope по ownCodes.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { resolveSidebarWorkingDealerClientCount } from "../dealer-base-sidebar-client-count";
import { roleScopedDealerRowsForReal } from "../dealer-base-real-scope";
import { applyDealerBasePickerFilters } from "../dealer-base-picker-filters";
import { defaultDealerBasePickerArgsForCount } from "../dealer-base-working-rows";
import { resolveSidebarTradePointsCount } from "../sidebar-trade-points-count";
import { countTradePointsWorkingRows } from "../trade-points-working-rows";
import { getReleaseClients } from "../release-client-data";
import type { ReleaseDemoProfile } from "../release-demo-profile";
import type { OrgSnapshot } from "../use-org-snapshot";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());

const TEAM_SKALABAN = "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa";
const ROP_SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const BOGACHEV = "10d1abcd-ee9b-42ff-916f-e9d4c43c9bd2";

function seedCountByTeam(catalogTeamId: string): number {
  return getReleaseClients().filter((c) => c.teamId === catalogTeamId).length;
}

function bogachevSnap(): OrgSnapshot {
  return {
    me: { id: BOGACHEV, role: "regional_manager", fullName: "Богачёв", teamId: TEAM_SKALABAN },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_SKALABAN, name: "Скалабан", ropUserId: ROP_SKALABAN, ropName: "Скалабан" }],
    users: [{ id: BOGACHEV, fullName: "Богачёв", role: "regional_manager", teamId: TEAM_SKALABAN, status: "active" }],
  } as unknown as OrgSnapshot;
}

const bogachevOwnCodes = new Set(
  allRows
    .filter((r) => r.releaseTeamId === "team-skalaban" && r.releaseCode?.trim())
    .slice(0, 5)
    .map((r) => r.releaseCode!.trim()),
);

const profile: ReleaseDemoProfile = { role: "team_lead", personaUserId: "user-tl-skalaban" };
const realScope: SidebarNavRealScope = {
  isRealUser: true,
  loading: false,
  ready: true,
  releaseDealerRows: allRows,
  orgScope: { snap: bogachevSnap(), access: "sales_manager" },
  assignmentsScope: {
    ownCodes: bogachevOwnCodes,
    teamCodes: new Set(),
    grantedCodes: new Set(),
  },
};

const emptyAct = createEmptyActualizationState();
const ctx = {
  enabled: false,
  loading: false,
  state: emptyAct,
  realScope,
  role: "regional_manager" as const,
};

// Без актуализации, но с real-scope: счётчик = scoped + picker по умолчанию (без «приостановлен»)
{
  const dealerCount = resolveSidebarWorkingDealerClientCount(profile, ctx);
  const scoped = roleScopedDealerRowsForReal(allRows, bogachevSnap(), "sales_manager", undefined, {
    ownCodes: bogachevOwnCodes,
    teamCodes: new Set(),
    grantedCodes: new Set(),
  });
  const expected = applyDealerBasePickerFilters(
    scoped,
    defaultDealerBasePickerArgsForCount(profile, "sales_manager", true),
  ).length;
  assert.equal(dealerCount, expected);
  assert.ok(dealerCount != null && dealerCount > 0);
  assert.ok(dealerCount! <= bogachevOwnCodes.size);
}

{
  const tpCount = resolveSidebarTradePointsCount(profile, ctx);
  const expectedTp = countTradePointsWorkingRows({
    profile,
    actEnabled: false,
    actState: emptyAct,
    realScope,
  });
  assert.equal(tpCount, expectedTp);
  assert.ok(tpCount != null && tpCount > 0);
}

// Пока real-scope грузится — null (не mock)
{
  const loadingCount = resolveSidebarWorkingDealerClientCount(profile, {
    ...ctx,
    realScope: { isRealUser: true, loading: true, ready: false },
  });
  assert.equal(loadingCount, null);
}

console.log("sidebar-counters: ok");
