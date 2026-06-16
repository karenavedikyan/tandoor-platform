/**
 * Запуск: `npm run test:role-scoped-rows-auto` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { DEALER_BASE_ROWS } from "../dealer-base-mock-data";
import { roleScopedDealerRows } from "../dealer-base-role-views";
import { roleScopedDealerRowsForReal } from "../dealer-base-real-scope";
import { getRoleScopedDealerRowsAuto } from "@/hooks/use-role-scoped-dealer-rows-auto";
import type { ReleaseDemoProfile } from "../release-demo-profile";
import type { OrgSnapshot } from "../use-org-snapshot";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";

const managerProfile: ReleaseDemoProfile = {
  role: "sales_manager",
  personaUserId: "mgr-boyko-em",
};

const teamLeadProfile: ReleaseDemoProfile = {
  role: "team_lead",
  personaUserId: "user-tl-kupiansky",
};

const managerSnap = {
  me: { id: "mgr-uuid-1", role: "manager", fullName: "Менеджер", teamId: "team-uuid" },
  visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
  teams: [],
  users: [{ id: "mgr-uuid-1", fullName: "Менеджер", role: "manager", teamId: "team-uuid" }],
} as unknown as OrgSnapshot;

const realScope: SidebarNavRealScope = {
  isRealUser: true,
  loading: false,
  ready: true,
  orgScope: { snap: managerSnap, access: "sales_manager" },
  assignmentsScope: {
    ownCodes: new Set(["MA-MA100001", "MA-MA100002"]),
    teamCodes: new Set(),
  },
};

// demo-fallback без realScope
{
  const viaAuto = getRoleScopedDealerRowsAuto(DEALER_BASE_ROWS, managerProfile, undefined);
  const viaDemo = roleScopedDealerRows(DEALER_BASE_ROWS, managerProfile);
  assert.equal(viaAuto.length, viaDemo.length);
  assert.deepEqual(
    viaAuto.map((r) => r.id).sort(),
    viaDemo.map((r) => r.id).sort(),
  );
}

// real-scope с ready
{
  const scopedRows = DEALER_BASE_ROWS.filter(
    (r) => r.releaseCode === "MA-MA100001" || r.releaseCode === "MA-MA100002",
  );
  if (scopedRows.length >= 2) {
    const viaAuto = getRoleScopedDealerRowsAuto(DEALER_BASE_ROWS, managerProfile, realScope);
    const viaReal = roleScopedDealerRowsForReal(
      DEALER_BASE_ROWS,
      managerSnap,
      "sales_manager",
      undefined,
      realScope.assignmentsScope,
    );
    assert.equal(viaAuto.length, viaReal.length);
    assert.deepEqual(
      viaAuto.map((r) => r.id).sort(),
      viaReal.map((r) => r.id).sort(),
    );
  }
}

// not-ready realScope → demo
{
  const loadingScope: SidebarNavRealScope = { isRealUser: true, loading: true, ready: false };
  const viaAuto = getRoleScopedDealerRowsAuto(DEALER_BASE_ROWS, teamLeadProfile, loadingScope);
  const viaDemo = roleScopedDealerRows(DEALER_BASE_ROWS, teamLeadProfile);
  assert.equal(viaAuto.length, viaDemo.length);
}

console.log("role-scoped-rows-auto: ok");
