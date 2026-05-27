/**
 * Запуск: `npm run test:real-org-adapter-defaults` из каталога apps/platform.
 *
 * HOTFIX 54-pre-A: дефолты picker в real-режиме — «all», scope в roleScopedDealerRowsForReal.
 */
import assert from "node:assert/strict";
import { realInitialRopManagerDefaults } from "../real-org-adapter";
import type { OrgSnapshot } from "../use-org-snapshot";

const snap = {
  me: {
    id: "dc958e02-d80e-4615-bb8a-8a46be70daed",
    role: "manager",
    fullName: "Скляров Давид Владимирович",
    teamId: "e5387f40-c693-44e6-ab17-e61a3ed0bd95",
  },
  visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
  teams: [{ id: "e5387f40-c693-44e6-ab17-e61a3ed0bd95", name: "Купянский", ropUserId: "ccffcf6e-2505-4eee-b257-ac65b60bb779", ropName: "Купянский" }],
  users: [
    {
      id: "dc958e02-d80e-4615-bb8a-8a46be70daed",
      role: "manager",
      fullName: "Скляров Давид Владимирович",
      teamId: "e5387f40-c693-44e6-ab17-e61a3ed0bd95",
    },
  ],
} as unknown as OrgSnapshot;

{
  const d = realInitialRopManagerDefaults(snap, "sales_manager");
  assert.deepEqual(d, { ropTeam: "all", manager: "all" }, "sales_manager: picker defaults all/all");
}

{
  const ropSnap = {
    ...snap,
    me: { ...snap.me, id: "ccffcf6e-2505-4eee-b257-ac65b60bb779", role: "rop" },
  } as unknown as OrgSnapshot;
  const d = realInitialRopManagerDefaults(ropSnap, "team_lead");
  assert.deepEqual(d, { ropTeam: "all", manager: "all" }, "team_lead: picker defaults all/all");
}

{
  const d = realInitialRopManagerDefaults(snap, "sales_director");
  assert.deepEqual(d, { ropTeam: "all", manager: "all" }, "sales_director: unchanged");
}

console.log("real-org-adapter-defaults: ok (3 cases)");
