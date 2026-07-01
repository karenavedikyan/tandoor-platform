/**
 * Запуск: npx tsx client/src/lib/__tests__/unassigned-responsible.test.ts
 */
import assert from "node:assert/strict";
import {
  getResponsibleGaps,
  isUnassigned,
  toResponsibleFlags,
} from "../unassigned-responsible";

const allAssigned = { hasManager: true, hasRegional: true, hasRop: true };
assert.equal(isUnassigned(allAssigned), false);
assert.deepEqual(getResponsibleGaps(allAssigned), []);

const noManager = { hasManager: false, hasRegional: true, hasRop: true };
assert.equal(isUnassigned(noManager), true);
assert.deepEqual(getResponsibleGaps(noManager), ["manager"]);

const noRegionalRop = { hasManager: true, hasRegional: false, hasRop: false };
assert.deepEqual(getResponsibleGaps(noRegionalRop), ["regional", "rop"]);

const none = { hasManager: false, hasRegional: false, hasRop: false };
assert.deepEqual(getResponsibleGaps(none), ["manager", "regional", "rop"]);

assert.equal(
  toResponsibleFlags({ managerUserId: "u1", regionalManagerId: "rm1", ropId: "rop1" }).hasManager,
  true,
);
assert.equal(toResponsibleFlags({ hasManager: true }).hasManager, true);
assert.equal(toResponsibleFlags({}).hasManager, false);

console.log("unassigned-responsible: ok");
