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
import { getPilotNavigation, flattenGroupedPilotNavigation } from "../auth-access";
import { loadReleaseDemoProfile } from "../release-demo-profile";
import { resolveSidebarWorkingDealerClientCount } from "../dealer-base-sidebar-client-count";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { getReleaseClients } from "../release-client-data";
import { mapUserRoleToDealerBaseAccess } from "../auth-user-dealer-access";
import type { OrgSnapshot } from "../use-org-snapshot";

type RoleExpectation = {
  role: UserRole;
  expectedSalesRole: string;
  /** Ожидаемая persona ID (для серверного юзера c этой ролью и НЕИЗВЕСТНЫМ UUID). */
  expectedFallbackPersona: string;
  /** Должны ли быть навигационные пункты. */
  navMustContain: string[];
  /** Если у роли есть собственный scope (counter > 0 при mock-данных). */
  hasOwnScope: boolean;
};

const CASES: RoleExpectation[] = [
  {
    role: "admin",
    expectedSalesRole: "sales_director",
    expectedFallbackPersona: "user-dir-goncharenko",
    navMustContain: ["nav-dealer-base", "nav-trade-points"],
    hasOwnScope: false,
  },
  {
    role: "director",
    expectedSalesRole: "sales_director",
    expectedFallbackPersona: "user-dir-goncharenko",
    navMustContain: ["nav-dealer-base", "nav-trade-points", "nav-sales-control"],
    hasOwnScope: false,
  },
  {
    role: "rop",
    expectedSalesRole: "team_lead",
    expectedFallbackPersona: "user-tl-kupiansky",
    navMustContain: ["nav-dealer-base", "nav-trade-points"],
    hasOwnScope: true,
  },
  {
    role: "regional_manager",
    expectedSalesRole: "team_lead",
    expectedFallbackPersona: "user-tl-kupiansky",
    navMustContain: ["nav-dealer-base"],
    hasOwnScope: true,
  },
  {
    role: "manager",
    expectedSalesRole: "sales_manager",
    expectedFallbackPersona: "mgr-boyko-em",
    navMustContain: ["nav-dealer-base"],
    hasOwnScope: true,
  },
  {
    role: "marketer",
    expectedSalesRole: "marketer",
    expectedFallbackPersona: "user-mkt-morozova",
    navMustContain: ["nav-dealer-base", "nav-listings"],
    hasOwnScope: false,
  },
  {
    role: "analyst",
    expectedSalesRole: "analyst",
    expectedFallbackPersona: "user-anl-ivanets",
    navMustContain: ["nav-analytics-workspace", "nav-dealer-base"],
    hasOwnScope: false,
  },
  {
    role: "category_manager",
    expectedSalesRole: "marketer",
    expectedFallbackPersona: "user-mkt-morozova",
    navMustContain: ["nav-dealer-base"],
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

function navIds(role: UserRole) {
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

  const snap = {
    me: { id: meId, role, fullName: "Тест", teamId: role === "rop" ? "team-demo" : null },
    visibility: { all: false, clientCodes: codes, teamIds: [], visibleUserIds: [] },
    teams:
      role === "rop"
        ? [{ id: "team-demo", name: "Команда", ropUserId: meId, ropName: "РОП" }]
        : [],
    users: [{ id: meId, role, fullName: "Тест", teamId: role === "rop" ? "team-demo" : null }],
  } as unknown as OrgSnapshot;

  const teamCodes = role === "rop" ? new Set(codes) : new Set<string>();
  const ownCodes = role === "manager" || role === "regional_manager" ? new Set(codes) : new Set<string>();

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
    const ids = navIds(c.role);
    assert.ok(ids.length > 0, `navigation для ${c.role} не должен быть пустым`);
    for (const must of c.navMustContain) {
      assert.ok(
        ids.includes(must),
        `nav для ${c.role} должен содержать ${must}; найдены: ${ids.join(", ")}`,
      );
    }
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

// ============ Сводка ============
console.log(`\n[role-smoke] passed: ${pass}, failed: ${fail}`);
if (fail > 0) {
  for (const f of failures) console.log(`\n${f}`);
  process.exit(1);
}
process.exit(0);
