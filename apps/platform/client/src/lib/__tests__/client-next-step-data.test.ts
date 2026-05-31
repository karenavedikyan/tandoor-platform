/**
 * Запуск: `npx tsx client/src/lib/__tests__/client-next-step-data.test.ts` из apps/platform.
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data";
import { canEditClientNextStep, hasSalesDirectorEditScope } from "../client-next-step-data";
import type { ReleaseDemoProfile } from "../release-demo-profile";

const dealer = {
  id: "client-ma-ma017341",
  releaseManagerId: "mgr-other",
  releaseTeamId: "team-other",
} as DealerRow;

const profile = (role: ReleaseDemoProfile["role"] | "admin", personaUserId = "u1"): ReleaseDemoProfile => ({
  role: role as ReleaseDemoProfile["role"],
  personaUserId,
});

assert.equal(hasSalesDirectorEditScope(profile("admin")), true, "legacy profile.role admin");
assert.equal(hasSalesDirectorEditScope(profile("sales_manager"), "admin"), true, "authRole admin");

assert.equal(
  canEditClientNextStep(profile("admin"), dealer),
  true,
  "profile.role admin can edit any dealer",
);
assert.equal(
  canEditClientNextStep(profile("sales_manager", "mgr-other"), dealer, "admin"),
  true,
  "platform admin authRole overrides scoped manager profile",
);
assert.equal(
  canEditClientNextStep(profile("sales_manager", "mgr-boyko-em"), dealer),
  false,
  "manager without scope cannot edit foreign dealer",
);
assert.equal(
  canEditClientNextStep(profile("sales_director"), dealer),
  true,
  "sales_director can edit any dealer",
);
assert.equal(
  canEditClientNextStep(profile("marketer"), dealer, "admin"),
  true,
  "platform admin keeps edit access while viewing as marketer",
);

console.log("client-next-step-data permissions: ok");
