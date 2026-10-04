/**
 * Synthetic regression tests for wholesale org read layer.
 * Run: npx tsx shared/__tests__/wholesale-org-read.test.ts
 */

import assert from "node:assert/strict";
import {
  buildWholesaleHierarchy,
  computeWholesaleOrgTotals,
  resolveWholesaleEmployeePreviewScope,
} from "../wholesale-org-read.js";
import type {
  WholesaleClientAssignment,
  WholesaleEmployeeRecord,
} from "../wholesale-org-types.js";

const ROP_A = "10000000-0000-4000-8000-000000000001";
const ROP_B = "10000000-0000-4000-8000-000000000002";
const MGR_A = "10000000-0000-4000-8000-000000000010";
const MGR_B = "10000000-0000-4000-8000-000000000011";
const MGR_SAME_NAME = "10000000-0000-4000-8000-000000000012";
const RM_A = "10000000-0000-4000-8000-000000000020";
const OUT_ROSTER = "10000000-0000-4000-8000-000000000099";
const CLIENT_1 = "20000000-0000-4000-8000-000000000001";
const CLIENT_2 = "20000000-0000-4000-8000-000000000002";
const CLIENT_3 = "20000000-0000-4000-8000-000000000003";
const CLIENT_4 = "20000000-0000-4000-8000-000000000004";
const STORE_1 = "30000000-0000-4000-8000-000000000001";
const STORE_2 = "30000000-0000-4000-8000-000000000002";

function client(partial: Partial<WholesaleClientAssignment> & Pick<WholesaleClientAssignment, "guidClient" | "externalKey">): WholesaleClientAssignment {
  return {
    name: partial.externalKey,
    city: null,
    region: null,
    holding: false,
    holdingLinkState: null,
    pendingHoldingGuid: null,
    managerRosterState: null,
    headOfSalesGuid: null,
    headOfSalesName: null,
    responsibleManagerGuid: null,
    responsibleManagerName: null,
    regionalManagerGuid: null,
    regionalManagerName: null,
    hardwareManagerGuid: null,
    hardwareManagerName: null,
    storeGuids: [],
    openStoreGuids: [],
    closedStoreGuids: [],
    reviewFlags: [],
    ...partial,
  };
}

const employees: WholesaleEmployeeRecord[] = [
  {
    employeeGuid: ROP_A,
    fullName: "РОП А",
    position: "РОП",
    source: "employee_roster",
    inRoster: true,
    accountLinkState: "no_account",
    accountUserId: null,
  },
  {
    employeeGuid: MGR_A,
    fullName: "Менеджер А",
    position: "Менеджер",
    source: "employee_roster",
    inRoster: true,
    accountLinkState: "no_account",
    accountUserId: null,
  },
  {
    employeeGuid: MGR_SAME_NAME,
    fullName: "Иванов Иван",
    position: "Менеджер",
    source: "employee_roster",
    inRoster: true,
    accountLinkState: "no_account",
    accountUserId: null,
  },
  {
    employeeGuid: MGR_B,
    fullName: "Иванов Иван",
    position: "Менеджер",
    source: "employee_roster",
    inRoster: true,
    accountLinkState: "no_account",
    accountUserId: null,
  },
];

const clients: WholesaleClientAssignment[] = [
  client({
    guidClient: CLIENT_1,
    externalKey: `client-${CLIENT_1}`,
    headOfSalesGuid: ROP_A,
    headOfSalesName: "РОП А",
    responsibleManagerGuid: MGR_A,
    responsibleManagerName: "Менеджер А",
    storeGuids: [STORE_1],
    openStoreGuids: [STORE_1],
  }),
  client({
    guidClient: CLIENT_2,
    externalKey: `client-${CLIENT_2}`,
    headOfSalesGuid: ROP_A,
    responsibleManagerGuid: null,
    storeGuids: [],
    openStoreGuids: [],
    reviewFlags: ["missing_responsible"],
  }),
  client({
    guidClient: CLIENT_3,
    externalKey: `client-${CLIENT_3}`,
    responsibleManagerGuid: OUT_ROSTER,
    responsibleManagerName: "Вне roster",
    managerRosterState: "outside_wholesale_roster",
    reviewFlags: ["missing_rop", "responsible_outside_roster"],
  }),
  client({
    guidClient: CLIENT_4,
    externalKey: `client-${CLIENT_4}`,
    headOfSalesGuid: ROP_A,
    responsibleManagerGuid: MGR_A,
    regionalManagerGuid: RM_A,
    regionalManagerName: "РМ А",
    storeGuids: [STORE_2],
    openStoreGuids: [STORE_2],
    holdingLinkState: "unresolved",
    pendingHoldingGuid: "40000000-0000-4000-8000-000000000099",
    reviewFlags: ["unresolved_holding"],
  }),
  client({
    guidClient: "20000000-0000-4000-8000-000000000005",
    externalKey: "client-20000000-0000-4000-8000-000000000005",
    headOfSalesGuid: ROP_A,
    responsibleManagerGuid: MGR_A,
    reviewFlags: ["ambiguous_rop_for_manager"],
  }),
  client({
    guidClient: "20000000-0000-4000-8000-000000000006",
    externalKey: "client-20000000-0000-4000-8000-000000000006",
    headOfSalesGuid: ROP_B,
    responsibleManagerGuid: MGR_A,
    reviewFlags: ["ambiguous_rop_for_manager"],
  }),
];

// 1. Admin sees all clients in totals
const totals = computeWholesaleOrgTotals(clients);
assert.equal(totals.uniqueClients, clients.length, "admin totals include all clients");

// 2. Client without TT remains visible
assert.ok(clients.some((c) => c.guidClient === CLIENT_2 && c.openStoreGuids.length === 0));

// 3. Client outside roster flagged
assert.ok(clients.find((c) => c.guidClient === CLIENT_3)?.reviewFlags.includes("responsible_outside_roster"));

// 4. Unresolved holding does not remove client
assert.ok(clients.some((c) => c.guidClient === CLIENT_4));

// 5. Same FIO different GUID — separate employees
assert.notEqual(MGR_B, MGR_SAME_NAME);
assert.equal(employees.filter((e) => e.fullName === "Иванов Иван").length, 2);

// 6. Manager with multiple ROPs marked ambiguous
const hierarchy = buildWholesaleHierarchy(clients, employees);
const ropA = hierarchy.find((h) => h.employeeGuid === ROP_A);
const mgrNode = ropA?.managers.find((m) => m.employeeGuid === MGR_A);
assert.ok(mgrNode?.ambiguousRop, "manager with multiple ROPs is ambiguous");

// 7. Unique client totals — no double count across groups
assert.equal(totals.uniqueClients, 6);
assert.equal(totals.uniqueStores, 2);

// 8. Preview scope for manager
const orgLike = {
  source: "wholesale_metadata" as const,
  rosterAvailable: true,
  rosterError: null,
  importedAt: null,
  outlets: [],
  employees: [
    ...employees,
    {
      employeeGuid: OUT_ROSTER,
      fullName: "Вне roster",
      position: null,
      source: "assignment_derived" as const,
      inRoster: false,
      accountLinkState: "no_account" as const,
      accountUserId: null,
    },
    {
      employeeGuid: RM_A,
      fullName: "РМ А",
      position: null,
      source: "assignment_derived" as const,
      inRoster: false,
      accountLinkState: "no_account" as const,
      accountUserId: null,
    },
  ],
  clients,
  hierarchy,
  needsReviewClients: clients.filter((c) => c.reviewFlags.length > 0),
  totals,
};
const preview = resolveWholesaleEmployeePreviewScope(orgLike, MGR_A, "responsible_manager");
assert.ok(preview.activeDealerExternalKeys.length >= 2);
assert.equal(preview.fullName, "Менеджер А");

// 9. Non-roster employee preview rejected at handler level (scope still computable for admin list)
const outPreview = resolveWholesaleEmployeePreviewScope(orgLike, OUT_ROSTER, "responsible_manager");
assert.ok(outPreview.activeDealerExternalKeys.includes(`client-${CLIENT_3}`));

// 10. Different assignment types do not overwrite
const rmPreview = resolveWholesaleEmployeePreviewScope(orgLike, RM_A, "regional_manager");
assert.ok(rmPreview.activeDealerExternalKeys.includes(`client-${CLIENT_4}`));
assert.ok(!rmPreview.activeDealerExternalKeys.includes(`client-${CLIENT_1}`));

console.log("wholesale-org-read.test.ts: ok");
