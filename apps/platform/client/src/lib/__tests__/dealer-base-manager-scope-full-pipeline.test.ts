/**
 * Промт 394: полный пайплайн «Мои клиенты» менеджера — 56 из 56.
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

const codes = Array.from({ length: 56 }, (_, i) => `MA-MA${String(100000 + i).padStart(6, "0")}`);
const externalKeys = new Set(codes.map((c) => `client-${c.toLowerCase()}`));

// 39 с ФИО Склярова, 17 с «чужим» manager_name (как в dealers.manager_name при client_assignments на Склярова).
const catalogRows: DealerRow[] = codes.map((_, i) =>
  makeRow(i, i < 39 ? SKLYAROV_NAME : "Другой Менеджер ООО"),
);

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

const assignmentsScope = buildAssignmentsScopeFromSources({
  ownCodes: new Set(codes),
  teamCodes: new Set(),
  grantedCodes: new Set(),
});

assert.ok(assignmentsScope);
assert.equal(assignmentsScope!.ownCodes.size, 56);

// Регрессия: без assignmentsScope fallback по имени даёт 39.
{
  const visible = getVisibleDealerRows(catalogRows, false, codes, externalKeys);
  assert.equal(visible.length, 56, "db external keys: 56 видимых строк каталога");

  const merged = excludeTrashedDealersFromWorkingRows(
    buildDealerBaseRowsWithActualization(act, profile, {
      includeArchivedDealers: false,
      releaseDealerRows: visible,
    }),
    act,
  );

  const withoutAssignments = roleScopedDealerRowsForReal(merged, snap, "sales_manager");
  assert.equal(withoutAssignments.length, 39, "fallback по manager_name: 39 (репродукция бага)");

  const withAssignments = roleScopedDealerRowsForReal(
    merged,
    snap,
    "sales_manager",
    undefined,
    assignmentsScope,
  );
  assert.equal(withAssignments.length, 56, "assignmentsScope: все 56");

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
    visibleCodes: codes,
    visibleAll: false,
  });
  assert.ok(visOnlyScope);
  const visible = filterDealerRowsByExternalKeys(catalogRows, externalKeys);
  const merged = buildDealerBaseRowsWithActualization(act, profile, {
    includeArchivedDealers: false,
    releaseDealerRows: visible,
  });
  const scoped = roleScopedDealerRowsForReal(merged, snap, "sales_manager", undefined, visOnlyScope);
  assert.equal(scoped.length, 56, "visibleCodes fallback: 56 без ожидания my-codes");
}

// case-insensitive client_code.
{
  const mixedCodes = new Set(codes.map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c)));
  const scope = buildAssignmentsScopeFromSources({ ownCodes: mixedCodes });
  const visible = getVisibleDealerRows(catalogRows, false, codes, externalKeys);
  const merged = buildDealerBaseRowsWithActualization(act, profile, {
    includeArchivedDealers: false,
    releaseDealerRows: visible,
  });
  const scoped = roleScopedDealerRowsForReal(merged, snap, "sales_manager", undefined, scope);
  assert.equal(scoped.length, 56, "mixed-case ownCodes: 56");
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
