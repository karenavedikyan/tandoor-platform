/**
 * Промт 394 / 418: полный пайплайн «Мои клиенты» менеджера — active-only из my-scope.
 * Запуск: `npm run test:manager-scope-full-pipeline` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import {
  buildDealerBaseRowsWithActualization,
  excludeTrashedDealersFromWorkingRows,
} from "../client-base-actualization-data-merge";
import type { DealerRow } from "../dealer-base-mock-data";
import { applyDealerBasePickerFilters } from "../dealer-base-picker-filters";
import {
  buildAssignmentsScopeFromSources,
  roleScopedDealerRowsForReal,
} from "../dealer-base-real-scope";
import { filterDealerRowsByExternalKeys, getVisibleDealerRows } from "../dealer-base-source";
import { isRopOrManagerAllFilter } from "../rop-manager-filters";
import { realInitialRopManagerDefaults } from "../real-org-adapter";
import type { OrgSnapshot } from "../use-org-snapshot";
import type { ReleaseDemoProfile } from "../release-demo-profile";

const SKLYAROV_UUID = "dc958e02-d80e-4615-bb8a-8a46be70daed";
const SKLYAROV_NAME = "Скляров Давид Владимирович";
const MGR_SLUG = "mgr-sklyarov-dv";

function makeRow(i: number, managerName: string): DealerRow {
  const code = `MA-MA${String(100000 + i).padStart(6, "0")}`;
  const id = `client-${code.toLowerCase()}`;
  return {
    id,
    releaseCode: code,
    name: `Клиент ${i}`,
    city: "Москва",
    manager: managerName,
    status: "активный",
    outlets: 1,
    distribution: 50,
    hasProblem: false,
    hasRecentActivity: true,
    clientCategory: "B",
    releaseTeamId: "team-kupiansky",
    releaseManagerId: MGR_SLUG,
    contacts: { lpr: "—", buyer: "—", phone: "—", email: "—", channel: "—" },
    tradePoints: [],
  } as DealerRow;
}

function makeCatalog(n: number): DealerRow[] {
  return Array.from({ length: n }, (_, i) => makeRow(i, SKLYAROV_NAME));
}

const codes = Array.from({ length: 56 }, (_, i) => `MA-MA${String(100000 + i).padStart(6, "0")}`);
const activeCodes = codes.slice(0, 44);
const externalKeysActive = new Set(activeCodes.map((c) => `client-${c.toLowerCase()}`));
const externalKeysAll = new Set(codes.map((c) => `client-${c.toLowerCase()}`));

const snap = {
  me: { id: SKLYAROV_UUID, role: "manager", fullName: SKLYAROV_NAME, teamId: "team-uuid" },
  visibility: { all: false, clientCodes: codes, teamIds: [], visibleUserIds: [] },
  teams: [],
  users: [{ id: SKLYAROV_UUID, fullName: SKLYAROV_NAME, role: "manager", teamId: "team-uuid" }],
} as unknown as OrgSnapshot;

const profile = {
  role: "sales_manager",
  personaUserId: MGR_SLUG,
} as ReleaseDemoProfile;

const act = createEmptyActualizationState();

function scopedRowsForManager410(
  merged: DealerRow[],
  useReal: boolean,
  access: string,
  selfDbScopeReady: boolean,
  dbKeys: Set<string> | null,
): DealerRow[] {
  if (useReal && access === "sales_manager" && selfDbScopeReady && dbKeys && dbKeys.size > 0) {
    return merged.filter((r) => dbKeys.has(r.id));
  }
  return merged;
}

function managerScopedRows410(
  pickerFiltered: DealerRow[],
  useReal: boolean,
  access: string,
  manager: string,
): DealerRow[] {
  if (useReal && access === "sales_manager") return pickerFiltered;
  if (isRopOrManagerAllFilter(manager)) return pickerFiltered;
  return pickerFiltered.filter((row) => row.releaseManagerId === manager);
}

function mergedRowsForDealerBaseManager411(
  releaseDealerRowsForScope: DealerRow[],
  actxEnabled: boolean,
  teamPlane: ReturnType<typeof createEmptyActualizationState>,
  profileForAct: ReleaseDemoProfile,
  meRole: string | undefined,
): DealerRow[] {
  if (meRole === "manager") {
    return releaseDealerRowsForScope;
  }
  if (!actxEnabled) return releaseDealerRowsForScope;
  return excludeTrashedDealersFromWorkingRows(
    buildDealerBaseRowsWithActualization(teamPlane, profileForAct, {
            releaseDealerRows: releaseDealerRowsForScope,
    }),
    teamPlane,
  );
}

// Промт 418: my-scope active keys (44) ≠ все assignments (56).
{
  const catalog = makeCatalog(100);
  const dbKeys = externalKeysActive;
  const releaseDealerRowsForScope = getVisibleDealerRows(catalog, false, codes, dbKeys);
  assert.equal(releaseDealerRowsForScope.length, 44, "active-only external keys: 44");

  const scoped = scopedRowsForManager410(releaseDealerRowsForScope, true, "sales_manager", true, dbKeys);
  assert.equal(scoped.length, 44, "418: scopedRows=44 active, не 56");
  assert.notEqual(scoped.length, codes.length, "418: active ≠ all assignment codes");
}

// Промт 411: actx.enabled + неполный plane — manager bypass, merged = release (active-only).
{
  const catalog = makeCatalog(100);
  const dbKeys = externalKeysActive;
  const releaseDealerRowsForScope = getVisibleDealerRows(catalog, false, codes, dbKeys);
  assert.equal(releaseDealerRowsForScope.length, 44);

  const incompletePlane = createEmptyActualizationState();
  for (let i = 4; i < releaseDealerRowsForScope.length; i++) {
    const row = releaseDealerRowsForScope[i]!;
    incompletePlane.trashedDealersById[row.id] = {
      dealerId: row.id,
      trashedAt: "2025-01-01T00:00:00Z",
      trashedBy: "test",
      trashedByName: "test",
      expiresAt: "2025-02-01T00:00:00Z",
      source: "manual_actualization",
    };
  }

  const withActxShrink = excludeTrashedDealersFromWorkingRows(
    buildDealerBaseRowsWithActualization(incompletePlane, profile, {
            releaseDealerRows: releaseDealerRowsForScope,
    }),
    incompletePlane,
  );
  assert.equal(withActxShrink.length, 4, "без bypass: неполный plane режет 56 → 4");

  const managerMerged = mergedRowsForDealerBaseManager411(
    releaseDealerRowsForScope,
    true,
    incompletePlane,
    profile,
    "manager",
  );
  assert.equal(
    managerMerged.length,
    44,
    "manager (real, actx.enabled): mergedRowsForDealerBase = releaseDealerRowsForScope (active-only)",
  );

  const scoped = scopedRowsForManager410(managerMerged, true, "sales_manager", true, dbKeys);
  assert.equal(scoped.length, 44, "411 + 410 pipeline: scopedRows=44 active");
}

// Промт 410: catalog ∩ dbScopedExternalKeys (active-only).
{
  const catalog = makeCatalog(100);
  const dbKeys = externalKeysActive;
  const out = catalog.filter((r) => dbKeys.has(r.id));
  assert.equal(out.length, 44, "manager (real) — scopedRows = catalog ∩ active dbScopedExternalKeys");
}

// Промт 410: полный pipeline — manager real, dbScopedExternalKeys=44 active.
{
  const catalog = makeCatalog(100);
  const dbKeys = externalKeysActive;
  const visible = getVisibleDealerRows(catalog, false, activeCodes, dbKeys);
  assert.equal(visible.length, 44);

  const merged = excludeTrashedDealersFromWorkingRows(
    buildDealerBaseRowsWithActualization(act, profile, {
            releaseDealerRows: visible,
    }),
    act,
  );

  const scoped = scopedRowsForManager410(merged, true, "sales_manager", true, dbKeys);
  assert.equal(scoped.length, 44, "scopedRows direct my-scope: 44 active");

  const realDefaults = realInitialRopManagerDefaults(snap, "sales_manager");
  const pickerFiltered = applyDealerBasePickerFilters(scoped, {
    search: "",
    quick: "all",
    cities: [],
    categories: [],
    ropTeam: realDefaults.ropTeam,
    ropTeamLabel: undefined,
    manager: realDefaults.manager,
    managerCatalogForRop: [],
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  });
  assert.equal(pickerFiltered.length, 44, "picker all/all: 44 active");

  const wrongManager = "dc958e02-d80e-4615-bb8a-8a46be70daed";
  const finalRows = managerScopedRows410(pickerFiltered, true, "sales_manager", wrongManager);
  assert.equal(finalRows.length, 44, "managerScopedRows ignores manager/ropTeam filter in real: 44 active");
}

// 39 с ФИО Склярова, 17 с «чужим» manager_name (как в dealers.manager_name при client_assignments на Склярова).
const catalogRows: DealerRow[] = codes.map((_, i) =>
  makeRow(i, i < 39 ? SKLYAROV_NAME : "Другой Менеджер ООО"),
);

const assignmentsScope = buildAssignmentsScopeFromSources({
  ownCodes: new Set(codes),
  teamCodes: new Set(),
  grantedCodes: new Set(),
});

assert.ok(assignmentsScope);
assert.equal(assignmentsScope!.ownCodes.size, 56);

// Регрессия: без assignmentsScope fallback по имени даёт 39.
{
  const visibleAll = getVisibleDealerRows(catalogRows, false, codes, externalKeysAll);
  assert.equal(visibleAll.length, 56, "all assignment external keys: 56");

  const mergedAll = excludeTrashedDealersFromWorkingRows(
    buildDealerBaseRowsWithActualization(act, profile, {
            releaseDealerRows: visibleAll,
    }),
    act,
  );

  const withAssignments = roleScopedDealerRowsForReal(
    mergedAll,
    snap,
    "sales_manager",
    undefined,
    assignmentsScope,
  );
  assert.equal(withAssignments.length, 56, "assignmentsScope (all 56 codes): legacy path still 56");

  const visible = getVisibleDealerRows(catalogRows, false, activeCodes, externalKeysActive);
  assert.equal(visible.length, 44, "db active external keys: 44 видимых строк каталога");

  const merged = excludeTrashedDealersFromWorkingRows(
    buildDealerBaseRowsWithActualization(act, profile, {
            releaseDealerRows: visible,
    }),
    act,
  );

  const withoutAssignments = roleScopedDealerRowsForReal(merged, snap, "sales_manager");
  assert.equal(withoutAssignments.length, 39, "fallback по manager_name: 39 (репродукция бага)");

  const activeOnlyScope = buildAssignmentsScopeFromSources({
    visibleCodes: activeCodes,
    visibleAll: false,
  });
  const withActiveOnly = roleScopedDealerRowsForReal(
    merged,
    snap,
    "sales_manager",
    undefined,
    activeOnlyScope,
  );
  assert.equal(withActiveOnly.length, 44, "418: assignmentsScope from active my-scope codes: 44");

  const pickerFiltered = applyDealerBasePickerFilters(withAssignments, {
    search: "",
    quick: "all",
    cities: [],
    categories: [],
    ropTeam: "all",
    manager: "all",
    managerCatalogForRop: [],
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  });
  assert.equal(pickerFiltered.length, 56, "picker default: 56");
}

// visPayload fallback до загрузки my-codes.
{
  const visOnlyScope = buildAssignmentsScopeFromSources({
    visibleCodes: activeCodes,
    visibleAll: false,
  });
  assert.ok(visOnlyScope);
  const visible = filterDealerRowsByExternalKeys(catalogRows, externalKeysActive);
  const merged = buildDealerBaseRowsWithActualization(act, profile, {
        releaseDealerRows: visible,
  });
  const scoped = roleScopedDealerRowsForReal(merged, snap, "sales_manager", undefined, visOnlyScope);
  assert.equal(scoped.length, 44, "418: active visibleCodes fallback: 44");
}

// case-insensitive client_code.
{
  const mixedCodes = new Set(codes.map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c)));
  const scope = buildAssignmentsScopeFromSources({ ownCodes: mixedCodes });
  const visible = getVisibleDealerRows(catalogRows, false, activeCodes, externalKeysActive);
  const merged = buildDealerBaseRowsWithActualization(act, profile, {
        releaseDealerRows: visible,
  });
  const scoped = roleScopedDealerRowsForReal(merged, snap, "sales_manager", undefined, scope);
  assert.equal(scoped.length, 44, "mixed-case ownCodes with active visible: 44");
}

// Промт 409: MA-MAxxx ownCodes + catalog id client-ma-maxxx → 56 строк.
{
  const maCodes = ["MA-MA121186", "MA-MA121653", "MA-MA129050"];
  const maRows: DealerRow[] = maCodes.map((code, i) => ({
    ...makeRow(i, SKLYAROV_NAME),
    id: `client-${code.toLowerCase()}`,
    releaseCode: code,
    releaseManagerId: MGR_SLUG,
  }));
  const maScope = buildAssignmentsScopeFromSources({ ownCodes: new Set(maCodes) });
  assert.ok(maScope);
  const scoped = roleScopedDealerRowsForReal(maRows, snap, "sales_manager", undefined, maScope);
  assert.equal(scoped.length, 3, "MA-MAxxx ownCodes vs client-ma-maxxx ids: все 3");
}

// Промт 409: fail-safe — ownCodes не матчит коды, но releaseManagerId = mgr-sklyarov-dv.
{
  const brokenRows: DealerRow[] = catalogRows.map((r, i) => ({
    ...r,
    id: `broken-key-${i}`,
    releaseCode: `WRONG-CODE-${i}`,
  }));
  const scoped = roleScopedDealerRowsForReal(
    brokenRows,
    snap,
    "sales_manager",
    undefined,
    assignmentsScope,
  );
  assert.equal(scoped.length, 56, "fail-safe: realRowsForManagerByUUID по releaseManagerId");
}

console.log("dealer-base-manager-scope-full-pipeline: ok");
