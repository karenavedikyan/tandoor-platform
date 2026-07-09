/**
 * Запуск: `npm run test:auth-access` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { UserRole } from "@shared/auth";
import { buildTrashNavBadge, canCreateResetLink, canAccessPathForUser, defaultHomePathForUserRole, flattenGroupedPilotNavigation, getPilotNavigation } from "../auth-access";

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

function groupedNav(role: Parameters<typeof getPilotNavigation>[0], platformUserRole: UserRole) {
  const model = getPilotNavigation(role, undefined, undefined, platformUserRole);
  assert.equal(model.layout, "grouped", `${platformUserRole}: expected grouped nav`);
  return model;
}

function leadingTestIds(role: Parameters<typeof getPilotNavigation>[0], platformUserRole: UserRole) {
  const model = groupedNav(role, platformUserRole);
  return (model.leadingItems ?? []).map((i) => i.testId);
}

function administrationTestIds(role: Parameters<typeof getPilotNavigation>[0], platformUserRole: UserRole) {
  const model = groupedNav(role, platformUserRole);
  const group = model.groups.find((g) => g.key === "administration");
  return group?.items.map((i) => i.testId) ?? null;
}

const TEAM_LEADERSHIP_ADMIN_IDS = [
  "nav-item-team-activity",
  "nav-item-admin-users",
  "nav-item-admin-client-assignments",
  "nav-item-admin-invitations",
  "nav-item-reset-requests",
] as const;

const TECHNICAL_ADMIN_ONLY_IDS = [
  "nav-item-admin-brief-migrate",
  "nav-item-admin-dealer-tp-migrate",
  "nav-item-admin-catalog-1c-migrate",
  "nav-item-admin-sync-health",
  "nav-item-admin-performance",
  "nav-item-admin-purge-queue",
  "nav-item-admin-actualization-dedupe",
  "nav-item-admin-audit",
] as const;

const adminIds = navTestIds("sales_director", "admin");
assert.ok(adminIds.includes("nav-item-admin-brief-migrate-top"), "admin: top migrate shortcut");
assert.ok(adminIds.includes("nav-item-admin-brief-migrate"), "admin: migrate in administration group");
assert.ok(adminIds.includes("nav-item-admin-users"), "admin: administration users link");
const adminAdministrationIds = administrationTestIds("sales_director", "admin");
assert.equal(adminAdministrationIds?.[0], "nav-item-team-activity", "admin: team first in administration");
assert.deepEqual(
  adminAdministrationIds?.slice(0, 3),
  ["nav-item-team-activity", "nav-item-admin-users", "nav-item-admin-client-assignments"],
  "admin: team leadership block order",
);
for (const id of TECHNICAL_ADMIN_ONLY_IDS) {
  assert.ok(adminAdministrationIds?.includes(id), `admin: includes ${id}`);
}
assert.ok(
  adminAdministrationIds?.indexOf("nav-item-admin-invitations")! >
    adminAdministrationIds!.indexOf("nav-item-admin-audit")!,
  "admin: invitations after technical items",
);
assert.equal(adminAdministrationIds?.at(-1), "nav-item-reset-requests", "admin: reset requests last");

const adminLeading = leadingTestIds("sales_director", "admin");
assert.equal(adminLeading[0], "nav-item-one-c-showroom", "admin: 1C showroom first in leadingItems");
assert.equal(adminLeading[1], "nav-item-clients-tps", "admin: legacy clients/tps after 1C showroom");

for (const [salesRole, platformUserRole] of [
  ["sales_manager", "manager"],
  ["team_lead", "rop"],
  ["team_lead", "regional_manager"],
  ["sales_director", "director"],
  ["marketer", "marketer"],
] as const) {
  assert.ok(
    !leadingTestIds(salesRole, platformUserRole).includes("nav-item-clients-tps"),
    `${platformUserRole}: no legacy clients/tps in leadingItems`,
  );
}
assert.ok(
  !navTestIds("analyst", "analyst").includes("nav-item-clients-tps"),
  "analyst: no legacy clients/tps in nav",
);

for (const role of ["admin", "director", "rop", "regional_manager", "manager"] as const) {
  assert.equal(defaultHomePathForUserRole(role), "/1c", `${role}: home is /1c`);
}
assert.equal(defaultHomePathForUserRole("marketer"), "/marketing-briefs", "marketer: home unchanged");
assert.equal(defaultHomePathForUserRole("analyst"), "/catalog", "analyst: home is /catalog");
assert.equal(defaultHomePathForUserRole("category_manager"), "/marketing-briefs", "category_manager: home is /marketing-briefs");

for (const role of ["manager", "director", "rop", "regional_manager", "marketer", "analyst", "category_manager"] as const) {
  assert.equal(canAccessPathForUser(role, "/dealer-base"), false, `${role}: no legacy dealer-base`);
  assert.equal(canAccessPathForUser(role, "/trade-points"), false, `${role}: no legacy trade-points`);
  assert.equal(canAccessPathForUser(role, "/client-map"), false, `${role}: no legacy client-map`);
}
assert.equal(canAccessPathForUser("admin", "/dealer-base"), true, "admin: legacy dealer-base");
assert.equal(canAccessPathForUser("admin", "/trade-points"), true, "admin: legacy trade-points");
assert.equal(canAccessPathForUser("admin", "/client-map"), true, "admin: legacy client-map");
assert.equal(canAccessPathForUser("manager", "/1c"), true, "manager: 1c showroom");
assert.equal(canAccessPathForUser("analyst", "/1c"), false, "analyst: no 1c showroom");

for (const salesRole of ["sales_manager", "team_lead", "sales_director"] as const) {
  const platformUserRole =
    salesRole === "sales_director" ? "director" : salesRole === "team_lead" ? "rop" : "manager";
  const ids = navTestIds(salesRole, platformUserRole);
  assert.ok(!ids.includes("nav-item-admin-brief-migrate-top"), `${salesRole}: no top migrate for non-admin`);
  assert.ok(!ids.includes("nav-item-admin-brief-migrate"), `${salesRole}: no migrate in nav for non-admin`);
  assert.ok(ids.includes("nav-item-marketing-briefs"), `${salesRole}: marketing briefs in main nav`);
  assert.ok(
    !leadingTestIds(salesRole, platformUserRole).includes("nav-item-team-activity"),
    `${salesRole}: team not in leadingItems`,
  );
  assert.ok(!ids.includes("nav-item-client-map"), `${salesRole}: no client-map for non-admin`);
}

for (const [salesRole, platformUserRole] of [
  ["sales_director", "director"],
  ["team_lead", "rop"],
  ["team_lead", "regional_manager"],
] as const) {
  const adminIdsForRole = administrationTestIds(salesRole, platformUserRole);
  assert.deepEqual(adminIdsForRole, [...TEAM_LEADERSHIP_ADMIN_IDS], `${platformUserRole}: team leadership administration items`);
  for (const id of TECHNICAL_ADMIN_ONLY_IDS) {
    assert.ok(!adminIdsForRole?.includes(id), `${platformUserRole}: no ${id}`);
  }
}

for (const [salesRole, platformUserRole] of [
  ["sales_manager", "manager"],
  ["marketer", "marketer"],
] as const) {
  assert.equal(
    administrationTestIds(salesRole, platformUserRole),
    null,
    `${platformUserRole}: no administration accordion`,
  );
}

const analystNav = getPilotNavigation("analyst", undefined, undefined, "analyst");
assert.equal(analystNav.layout, "flat", "analyst: flat nav");
assert.ok(
  !navTestIds("analyst", "analyst").includes("nav-group-administration"),
  "analyst: no administration items",
);

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

const navWithTrashCounts = getPilotNavigation("sales_manager", 44, 33, "manager", 12, 10);
assert.equal(navWithTrashCounts.layout, "grouped");
if (navWithTrashCounts.layout === "grouped") {
  const flat = flattenGroupedPilotNavigation(navWithTrashCounts);
  assert.equal(flat.find((i) => i.testId === "nav-item-trash"), undefined, "trash removed from sidebar nav");
}

console.log("auth-access trash badge: ok");
