/**
 * Запуск: `npm run test:auth-access` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { UserRole } from "@shared/auth";
import { buildTrashNavBadge, canCreateResetLink, flattenGroupedPilotNavigation, getPilotNavigation } from "../auth-access";

const U = (id: string, role: UserRole) => ({ id, role });

function t(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
  expected: boolean,
  label: string,
): void {
  assert.equal(canCreateResetLink(actor, target), expected, label);
}

t(U("a1", "admin"), U("a2", "admin"), false, "admin→admin запрет");
t(U("a1", "admin"), U("d1", "director"), true, "admin→director ок");
t(U("d1", "director"), U("a1", "admin"), false, "director→admin запрет");
t(U("r1", "rop"), U("m1", "manager"), true, "rop→manager ок");
t(U("r1", "rop"), U("rm1", "regional_manager"), true, "rop→regional_manager ок");
t(U("r1", "rop"), U("d2", "director"), false, "rop→director запрет");
t(U("m1", "manager"), U("m2", "manager"), false, "manager→manager запрет");
t(U("d1", "director"), U("d1", "director"), false, "self запрет");

console.log("auth-access reset-link matrix: ok");

function navTestIds(role: Parameters<typeof getPilotNavigation>[0], platformUserRole: UserRole) {
  const model = getPilotNavigation(role, undefined, undefined, platformUserRole);
  if (model.layout === "flat") return model.items.map((i) => i.testId);
  return flattenGroupedPilotNavigation(model).map((i) => i.testId);
}

const adminIds = navTestIds("sales_director", "admin");
assert.ok(adminIds.includes("nav-item-admin-brief-migrate-top"), "admin: top migrate shortcut");
assert.ok(adminIds.includes("nav-item-admin-brief-migrate"), "admin: migrate in administration group");
assert.ok(adminIds.includes("nav-item-admin-users"), "admin: administration users link");

for (const salesRole of ["sales_manager", "team_lead", "sales_director"] as const) {
  const ids = navTestIds(salesRole, salesRole === "sales_director" ? "director" : salesRole === "team_lead" ? "rop" : "manager");
  assert.ok(!ids.includes("nav-item-admin-brief-migrate-top"), `${salesRole}: no top migrate for non-admin`);
  assert.ok(!ids.includes("nav-item-admin-brief-migrate"), `${salesRole}: no migrate in nav for non-admin`);
  assert.ok(ids.includes("nav-item-marketing-briefs"), `${salesRole}: marketing briefs in main nav`);
}

const managerNav = navTestIds("sales_manager", "manager");
const devGroup = getPilotNavigation("sales_manager", undefined, undefined, "manager");
assert.equal(devGroup.layout, "grouped");
if (devGroup.layout === "grouped") {
  const devItems = devGroup.groups.find((g) => g.key === "in-development")?.items ?? [];
  assert.ok(
    !devItems.some((i) => i.testId === "nav-item-marketing-briefs"),
    "sales_manager: marketing briefs not in in-development",
  );
}
assert.ok(managerNav.filter((id) => id === "nav-item-marketing-briefs").length === 1, "single marketing briefs entry");

console.log("auth-access pilot navigation admin shortcut: ok");

assert.deepEqual(buildTrashNavBadge(12, 10), { badge: "12/10" });
assert.deepEqual(buildTrashNavBadge(12, 0), { badge: 12 });
assert.deepEqual(buildTrashNavBadge(0, 5), { badge: 5 });
assert.deepEqual(buildTrashNavBadge(0, 0), {});
assert.deepEqual(buildTrashNavBadge(null, 0), { badgeLoading: true });

const navWithTrash = getPilotNavigation("sales_manager", 44, 33, "manager", 12, 10);
assert.equal(navWithTrash.layout, "grouped");
if (navWithTrash.layout === "grouped") {
  const flat = flattenGroupedPilotNavigation(navWithTrash);
  const trashItem = flat.find((i) => i.testId === "nav-item-trash");
  assert.equal(trashItem?.badge, "12/10", "418: trash nav badge dealers/tp");
}

console.log("auth-access trash badge: ok");
