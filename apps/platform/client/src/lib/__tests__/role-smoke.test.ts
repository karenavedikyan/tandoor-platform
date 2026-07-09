/**
 * Промт 335: smoke-тесты на каждую UserRole. Проверяют минимальный инвариант:
 *   - Navigation для роли формируется и содержит ожидаемые пункты.
 *   - `loadReleaseDemoProfile` подбирает корректный persona (или fallback) без падений.
 *   - `getPilotNavigation` не бросает, layout соответствует ожиданию.
 *   - Для ролей со scope (rop, manager, regional_manager) — счётчик сайдбара
 *     `resolveSidebarWorkingDealerClientCount` возвращает > 0 в типичной ситуации
 *     (mock realScope с непустым releaseDealerRows + assignmentsScope).
 *   - Для admin/director/marketer/analyst/category_manager — sidebar не падает,
 *     возвращает либо число, либо null (loading).
 *
 * Запуск: `npm run test:role-smoke` из каталога apps/platform.
 *
 * Цель — поймать регрессии типа «у новой роли counter = 0» / «navigation пустой»
 * / «persona = undefined» ДО прода. Любой PR, ломающий smoke, не мержится.
 */

import assert from "node:assert/strict";
import type { UserRole } from "@shared/auth";
import { userRoleToSalesRole } from "../role-mapping";
import { getPilotNavigation, flattenGroupedPilotNavigation, defaultHomePathForUserRole } from "../auth-access";
import { loadReleaseDemoProfile } from "../release-demo-profile";
import { resolveSidebarWorkingDealerClientCount } from "../dealer-base-sidebar-client-count";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { getReleaseClients } from "../release-client-data";
import { mapUserRoleToDealerBaseAccess } from "../auth-user-dealer-access";
import type { OrgSnapshot } from "../use-org-snapshot";
import { buildTeamSummaries } from "../team-summary";
import {
  initialRopManagerForProfile,
  roleScopedDealerRows,
} from "../dealer-base-role-views";
import { clearRealScopeAuditBufferForTests } from "../real-scope-audit";
import type { ReleaseDemoProfile } from "../release-demo-profile";

type RoleExpectation = {
  role: UserRole;
  expectedSalesRole: string;
  /** Ожидаемая persona ID (для серверного юзера c этой ролью и НЕИЗВЕСТНЫМ UUID). */
  expectedFallbackPersona: string;
  /** Должны ли быть навигационные пункты. */
  navMustContain: string[];
  /** Не должны быть в навигации (testId или navBehaviorId). */
  navMustNotContain?: string[];
  /** Ожидаемый home path после логина. */
  expectedHomePath?: string;
  /** Если у роли есть собственный scope (counter > 0 при mock-данных). */
  hasOwnScope: boolean;
};

const CASES: RoleExpectation[] = [
  {
    role: "admin",
    expectedSalesRole: "sales_director",
    expectedFallbackPersona: "user-dir-goncharenko",
    navMustContain: ["nav-one-c-showroom", "nav-item-clients-tps"],
    navMustNotContain: [],
    expectedHomePath: "/1c",
    hasOwnScope: false,
  },
  {
    role: "director",
    expectedSalesRole: "sales_director",
    expectedFallbackPersona: "user-dir-goncharenko",
    navMustContain: ["nav-one-c-showroom", "nav-sales-control"],
    navMustNotContain: ["nav-item-clients-tps"],
    expectedHomePath: "/1c",
    hasOwnScope: false,
  },
  {
    role: "rop",
    expectedSalesRole: "team_lead",
    expectedFallbackPersona: "user-tl-kupiansky",
    navMustContain: ["nav-one-c-showroom"],
    navMustNotContain: ["nav-item-clients-tps"],
    expectedHomePath: "/1c",
    hasOwnScope: true,
  },
  {
    role: "regional_manager",
    expectedSalesRole: "team_lead",
    expectedFallbackPersona: "user-tl-kupiansky",
    navMustContain: ["nav-one-c-showroom"],
    navMustNotContain: ["nav-item-clients-tps"],
    expectedHomePath: "/1c",
    hasOwnScope: true,
  },
  {
    role: "manager",
    expectedSalesRole: "sales_manager",
    expectedFallbackPersona: "mgr-boyko-em",
    navMustContain: ["nav-one-c-showroom"],
    navMustNotContain: ["nav-item-clients-tps"],
    expectedHomePath: "/1c",
    hasOwnScope: true,
  },
  {
    role: "marketer",
    expectedSalesRole: "marketer",
    expectedFallbackPersona: "user-mkt-morozova",
    navMustContain: ["nav-listings"],
    navMustNotContain: ["nav-item-clients-tps"],
    expectedHomePath: "/marketing-briefs",
    hasOwnScope: false,
  },
  {
    role: "analyst",
    expectedSalesRole: "analyst",
    expectedFallbackPersona: "user-anl-ivanets",
    navMustContain: ["nav-item-distribution"],
    navMustNotContain: ["nav-item-clients-tps", "nav-client-map"],
    expectedHomePath: "/catalog",
    hasOwnScope: false,
  },
  {
    role: "category_manager",
    expectedSalesRole: "marketer",
    expectedFallbackPersona: "user-mkt-morozova",
    navMustContain: ["nav-listings"],
    navMustNotContain: ["nav-item-clients-tps", "nav-client-map"],
    expectedHomePath: "/marketing-briefs",
    hasOwnScope: false,
  },
];

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());

let pass = 0;
let fail = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`✓ ${name}`);
  } catch (e) {
    fail++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${name}\n  ${msg}`);
    console.log(`✗ ${name}\n  ${msg}`);
  }
}

function navTestIds(role: UserRole) {
  const sr = userRoleToSalesRole(role);
  const nav = getPilotNavigation(sr, 100, 50, role);
  const items = nav.layout === "grouped" ? flattenGroupedPilotNavigation(nav) : nav.items;
  return items.map((x) => x.testId ?? x.navBehaviorId);
}

function navBehaviorIds(role: UserRole) {
  const sr = userRoleToSalesRole(role);
  const nav = getPilotNavigation(sr, 100, 50, role);
  const items = nav.layout === "grouped" ? flattenGroupedPilotNavigation(nav) : nav.items;
  return items.map((x) => x.navBehaviorId ?? x.testId);
}

function mockScopedRealScope(role: UserRole): SidebarNavRealScope {
  const sampleRows = allRows.filter((r) => r.releaseCode?.trim()).slice(0, 5);
  assert.ok(sampleRows.length >= 3, "fixture: release rows with codes");
  const codes = sampleRows.map((r) => r.releaseCode!.trim());

  const access = mapUserRoleToDealerBaseAccess(role);
  const meId = "00000000-0000-0000-0000-000000000001";
  const teamUuid = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";
  const ropUserId = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
  const leadershipRole = role === "rop";
  const teamCodes = role === "rop" ? new Set(codes) : new Set<string>();
  const ownCodes =
    role === "manager" || role === "regional_manager" ? new Set(codes) : new Set<string>();

  const snap = {
    me: {
      id: meId,
      role,
      fullName: "Тест",
      teamId: leadershipRole || role === "regional_manager" ? teamUuid : null,
    },
    visibility: { all: false, clientCodes: codes, teamIds: [], visibleUserIds: [] },
    teams: leadershipRole
      ? [{ id: teamUuid, name: "Купянский", ropUserId, ropName: "Купянский" }]
      : role === "regional_manager"
        ? [{ id: teamUuid, name: "Купянский", ropUserId, ropName: "Купянский" }]
        : [],
    users: [
      {
        id: meId,
        role,
        fullName: "Тест",
        teamId: leadershipRole || role === "regional_manager" ? teamUuid : null,
      },
    ],
  } as unknown as OrgSnapshot;

  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: allRows,
    orgScope: { snap, access },
    assignmentsScope: {
      ownCodes,
      teamCodes,
      grantedCodes: new Set<string>(),
    },
  };
}

function mockFullAccessRealScope(role: UserRole): SidebarNavRealScope {
  const access = mapUserRoleToDealerBaseAccess(role);
  const snap = {
    me: { id: "dir-demo", role, fullName: "Тест", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [],
  } as unknown as OrgSnapshot;

  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: allRows,
    orgScope: { snap, access },
  };
}

// ============ 1. userRoleToSalesRole ============
for (const c of CASES) {
  test(`userRoleToSalesRole(${c.role}) === ${c.expectedSalesRole}`, () => {
    assert.equal(userRoleToSalesRole(c.role), c.expectedSalesRole);
  });
}

// ============ 2. loadReleaseDemoProfile ============
// @ts-expect-error: node без window
globalThis.window = { sessionStorage: { getItem: () => null, setItem: () => undefined } };

for (const c of CASES) {
  test(`loadReleaseDemoProfile(${c.role}, unknown UUID) → fallback persona`, () => {
    const p = loadReleaseDemoProfile(c.role, "00000000-0000-0000-0000-000000000000");
    assert.equal(
      p.personaUserId,
      c.expectedFallbackPersona,
      `expected ${c.expectedFallbackPersona}, got ${p.personaUserId}`,
    );
  });
}

test("loadReleaseDemoProfile(rop, Сапожков UUID) → user-tl-sapozhkov", () => {
  const p = loadReleaseDemoProfile("rop", "c36f625f-730e-4ae3-b118-bdb005d10b81");
  assert.equal(p.personaUserId, "user-tl-sapozhkov");
});

test("loadReleaseDemoProfile(rop, Скалабан UUID) → user-tl-skalaban", () => {
  const p = loadReleaseDemoProfile("rop", "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa");
  assert.equal(p.personaUserId, "user-tl-skalaban");
});

test("loadReleaseDemoProfile(rop, Купянский UUID) → user-tl-kupiansky", () => {
  const p = loadReleaseDemoProfile("rop", "ccffcf6e-2505-4eee-b257-ac65b60bb779");
  assert.equal(p.personaUserId, "user-tl-kupiansky");
});

// ============ 3. getPilotNavigation ============
for (const c of CASES) {
  test(`getPilotNavigation(${c.role}): не падает + содержит ожидаемые nav-items`, () => {
    const ids = navBehaviorIds(c.role);
    const testIds = navTestIds(c.role);
    assert.ok(ids.length > 0, `navigation для ${c.role} не должен быть пустым`);
    for (const must of c.navMustContain) {
      const found = ids.includes(must) || testIds.includes(must);
      assert.ok(
        found,
        `nav для ${c.role} должен содержать ${must}; найдены: ${ids.join(", ")}`,
      );
    }
    for (const mustNot of c.navMustNotContain ?? []) {
      const found = testIds.includes(mustNot) || ids.includes(mustNot);
      assert.ok(!found, `nav для ${c.role} не должен содержать ${mustNot}`);
    }
  });
}

for (const c of CASES) {
  if (!c.expectedHomePath) continue;
  test(`defaultHomePathForUserRole(${c.role}) === ${c.expectedHomePath}`, () => {
    assert.equal(defaultHomePathForUserRole(c.role), c.expectedHomePath);
  });
}

// ============ 4. Sidebar dealer count для ролей с собственным scope ============
for (const c of CASES) {
  if (!c.hasOwnScope) continue;
  test(`Sidebar dealer count для ${c.role}: counter > 0 в real-режиме с непустым scope`, () => {
    const realScope = mockScopedRealScope(c.role);
    const profile = loadReleaseDemoProfile(c.role, "ccffcf6e-2505-4eee-b257-ac65b60bb779");
    const count = resolveSidebarWorkingDealerClientCount(profile, {
      enabled: true,
      loading: false,
      state: createEmptyActualizationState(),
      realScope,
    });
    assert.ok(
      count !== null && count > 0,
      `${c.role}: ожидался counter > 0, получено ${count}. ` +
        "Если 0 — picker режет строки по profile-based ropTeam (регрессия промта 332).",
    );
  });
}

// Для admin/director/marketer/analyst/category_manager: counter не должен падать
for (const c of CASES) {
  if (c.hasOwnScope) continue;
  test(`Sidebar dealer count для ${c.role}: не падает, возвращает number|null`, () => {
    const realScope = mockFullAccessRealScope(c.role);
    const profile = loadReleaseDemoProfile(c.role, null);
    const count = resolveSidebarWorkingDealerClientCount(profile, {
      enabled: true,
      loading: false,
      state: createEmptyActualizationState(),
      realScope,
    });
    assert.ok(
      count === null || typeof count === "number",
      `${c.role}: counter должен быть number|null, получено ${typeof count} (${count})`,
    );
  });
}

// ============ 5. Промт 338: audit demo-fallback call-sites ============
test("Промт 338: team_lead demo-path → audit buffer", () => {
  clearRealScopeAuditBufferForTests();
  const teamLeadProfile = {
    role: "team_lead",
    personaUserId: "user-tl-kupiansky",
  } as ReleaseDemoProfile;
  buildTeamSummaries(teamLeadProfile);
  initialRopManagerForProfile(teamLeadProfile, "team_lead");
  roleScopedDealerRows(allRows.slice(0, 3), teamLeadProfile);
  const buf = globalThis.__REAL_SCOPE_AUDIT_BUFFER__ ?? [];
  assert.ok(buf.length >= 3, "team_lead: logRealScopeAudit должен сработать на demo-путях");
  assert.ok(
    buf.some((e) => e.callSite.includes("buildTeamSummaries@team-summary")),
    "team_lead: buildTeamSummaries маркер",
  );
});

for (const role of ["admin", "director"] as const) {
  test(`Промт 338: ${role} (sales_director) — нет demo-fallback audit`, () => {
    clearRealScopeAuditBufferForTests();
    const profile = loadReleaseDemoProfile(role, null);
    buildTeamSummaries(profile);
    roleScopedDealerRows(allRows.slice(0, 3), profile);
    const buf = globalThis.__REAL_SCOPE_AUDIT_BUFFER__ ?? [];
    const demoFallback = buf.filter((e) => e.reason === "demo-fallback-for-real-user");
    assert.equal(
      demoFallback.length,
      0,
      `${role}: sales_director не должен триггерить team_lead demo-маркеры`,
    );
  });
}

test("Промт 338: manager (sales_manager) — нет team_lead demo-fallback audit", () => {
  clearRealScopeAuditBufferForTests();
  const mgrProfile = {
    role: "sales_manager",
    personaUserId: "mgr-boyko-em",
  } as ReleaseDemoProfile;
  roleScopedDealerRows(allRows.slice(0, 3), mgrProfile);
  const buf = globalThis.__REAL_SCOPE_AUDIT_BUFFER__ ?? [];
  assert.equal(buf.length, 0, "manager: sales_manager path без team_lead маркеров");
});

// ============ Сводка ============
console.log(`\n[role-smoke] passed: ${pass}, failed: ${fail}`);
if (fail > 0) {
  for (const f of failures) console.log(`\n${f}`);
  process.exit(1);
}
process.exit(0);
