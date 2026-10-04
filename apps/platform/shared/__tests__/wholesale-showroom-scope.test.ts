/**
 * Wholesale hierarchy viewer scope + detail access.
 * Run: npx tsx shared/__tests__/wholesale-showroom-scope.test.ts
 */

import assert from "node:assert/strict";
import {
  filterWholesaleHierarchyForViewer,
  canViewWholesaleEmployeePage,
} from "../wholesale-showroom-scope.js";
import type { OneCRopNode } from "../one-c-showroom-context.js";
import type { WholesaleOrgReadResult } from "../wholesale-org-types.js";

const ROP_A = "10000000-0000-4000-8000-000000000001";
const ROP_B = "10000000-0000-4000-8000-000000000002";
const MGR_A = "10000000-0000-4000-8000-000000000010";
const RM_A = "10000000-0000-4000-8000-000000000020";

const items: OneCRopNode[] = [
  {
    userId: ROP_A,
    fullName: "РОП А",
    phone: null,
    email: null,
    teamId: ROP_A,
    teamName: "РОП А",
    rmCount: 1,
    managerCount: 1,
    storeCount: 1,
    legalCount: 1,
    rms: [{ userId: RM_A, fullName: "РМ А", phone: null, storeCount: 1, legalCount: 1, hasMatch: true, managers: [] }],
    managers: [{ userId: MGR_A, fullName: "Менеджер А", phone: null, storeCount: 1, legalCount: 1, hasMatch: true }],
  },
  {
    userId: ROP_B,
    fullName: "РОП Б",
    phone: null,
    email: null,
    teamId: ROP_B,
    teamName: "РОП Б",
    rmCount: 0,
    managerCount: 0,
    storeCount: 0,
    legalCount: 0,
    rms: [],
    managers: [],
  },
];

const org = {
  employees: [],
  clients: [
    {
      guidClient: "c1",
      externalKey: "client-c1",
      headOfSalesGuid: ROP_A,
      regionalManagerGuid: RM_A,
      responsibleManagerGuid: MGR_A,
    },
  ],
} as unknown as WholesaleOrgReadResult;

// Admin sees all
assert.equal(filterWholesaleHierarchyForViewer(items, { id: "admin", role: "admin" }, null).length, 2);

// ROP without confirmed link sees nothing
assert.equal(
  filterWholesaleHierarchyForViewer(items, { id: "rop-user", role: "rop" }, null).length,
  0,
);

// ROP A sees only own team
const ropFiltered = filterWholesaleHierarchyForViewer(
  items,
  { id: "rop-user", role: "rop" },
  ROP_A,
);
assert.equal(ropFiltered.length, 1);
assert.equal(ropFiltered[0]!.userId, ROP_A);

// Other ROP cannot see ROP B data when confirmed as ROP A
assert.equal(ropFiltered.some((n) => n.userId === ROP_B), false);

// RM sees only own subtree
const rmFiltered = filterWholesaleHierarchyForViewer(
  items,
  { id: "rm-user", role: "regional_manager" },
  RM_A,
);
assert.equal(rmFiltered.length, 1);
assert.equal(rmFiltered[0]!.rms.length, 1);
assert.equal(rmFiltered[0]!.rms[0]!.userId, RM_A);

// Manager page guard
assert.equal(
  canViewWholesaleEmployeePage({ id: "m", role: "manager" }, MGR_A, "manager", org, MGR_A),
  true,
);
assert.equal(
  canViewWholesaleEmployeePage({ id: "m", role: "manager" }, MGR_A, "manager", org, "other"),
  false,
);

console.log("wholesale-showroom-scope.test.ts: ok");
