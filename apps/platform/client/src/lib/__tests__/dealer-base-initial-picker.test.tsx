/**
 * Промт 407/408: initial picker — demo из profile, real из realInitialRopManagerDefaults (all/all).
 * Запуск: `npm run test:dealer-base-initial-picker` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data";
import { applyDealerBasePickerFilters } from "../dealer-base-picker-filters";
import {
  buildAssignmentsScopeFromSources,
  roleScopedDealerRowsForReal,
} from "../dealer-base-real-scope";
import { initialRopManagerForProfile } from "../dealer-base-role-views";
import { loadReleaseDemoProfile } from "../release-demo-profile";
import { realInitialRopManagerDefaults } from "../real-org-adapter";
import { isRopOrManagerAllFilter } from "../rop-manager-filters";
import type { OrgSnapshot } from "../use-org-snapshot";

const SKLYAROV_UUID = "dc958e02-d80e-4615-bb8a-8a46be70daed";
const MGR_SLUG = "mgr-sklyarov-dv";
const TEAM_KUPIANSKY = "team-kupiansky";

function makeRow(i: number): DealerRow {
  const code = `MA-MA${String(100000 + i).padStart(6, "0")}`;
  return {
    id: `client-${code.toLowerCase()}`,
    releaseCode: code,
    name: `Клиент ${i}`,
    city: "Москва",
    manager: "Скляров Давид Владимирович",
    status: "активный",
    outlets: 1,
    distribution: 50,
    hasProblem: false,
    hasRecentActivity: true,
    clientCategory: "B",
    releaseTeamId: TEAM_KUPIANSKY,
    releaseManagerId: MGR_SLUG,
    contacts: { lpr: "—", buyer: "—", phone: "—", email: "—", channel: "—" },
    tradePoints: [],
  } as DealerRow;
}

const catalogRows = Array.from({ length: 56 }, (_, i) => makeRow(i));
const codes = catalogRows.map((r) => r.releaseCode!);

const sklyarovSnap = {
  me: { id: SKLYAROV_UUID, role: "manager", fullName: "Скляров Д.В.", teamId: "team-uuid" },
  visibility: { all: false, clientCodes: codes, teamIds: [], visibleUserIds: [] },
  teams: [],
  users: [{ id: SKLYAROV_UUID, fullName: "Скляров Д.В.", role: "manager", teamId: "team-uuid" }],
} as unknown as OrgSnapshot;

function managerScopedRows(pickerFiltered: DealerRow[], manager: string): DealerRow[] {
  if (isRopOrManagerAllFilter(manager)) return pickerFiltered;
  return pickerFiltered.filter((row) => row.releaseManagerId === manager);
}

// loadReleaseDemoProfile() без server user в node → Boyko (не использовать в useState init).
{
  const withoutUser = loadReleaseDemoProfile();
  assert.equal(withoutUser.personaUserId, "mgr-boyko-em");
}

// Кейс A (demo): profile Склярова → конкретный менеджер и команда.
{
  const defaults = initialRopManagerForProfile(
    { role: "sales_manager", personaUserId: MGR_SLUG },
    "sales_manager",
  );
  assert.equal(defaults.ropTeam, TEAM_KUPIANSKY);
  assert.equal(defaults.manager, MGR_SLUG);
}

// Кейс B (real): org snap → picker all/all (scope сужается отдельно).
{
  const defaults = realInitialRopManagerDefaults(sklyarovSnap, "sales_manager");
  assert.equal(defaults.ropTeam, "all");
  assert.equal(defaults.manager, "all");
}

// Boyko demo defaults → 0 строк; Sklyarov demo defaults → 56.
{
  const boyko = loadReleaseDemoProfile();
  const boykoDefaults = initialRopManagerForProfile(boyko, "sales_manager");
  const sklyarovDefaults = initialRopManagerForProfile(
    { role: "sales_manager", personaUserId: MGR_SLUG },
    "sales_manager",
  );

  const pickerArgs = (ropTeam: string, manager: string) => ({
    search: "",
    quick: "all" as const,
    cities: [] as string[],
    categories: [] as [],
    ropTeam,
    manager,
    managerCatalogForRop: [],
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  });

  const broken = applyDealerBasePickerFilters(
    catalogRows,
    pickerArgs(boykoDefaults.ropTeam, boykoDefaults.manager),
  );
  const fixed = applyDealerBasePickerFilters(
    catalogRows,
    pickerArgs(sklyarovDefaults.ropTeam, sklyarovDefaults.manager),
  );

  assert.equal(broken.length, 0, "старый init (Boyko): 0 из 56");
  assert.equal(fixed.length, 56, "demo profile init (Скляров): 56 из 56");
}

// Smoke real-Скляров: scoped 56 + picker all/all → list 56 (промт 408).
{
  const assignmentsScope = buildAssignmentsScopeFromSources({
    ownCodes: new Set(codes),
    teamCodes: new Set(),
    grantedCodes: new Set(),
  });
  assert.ok(assignmentsScope);

  const scoped = roleScopedDealerRowsForReal(
    catalogRows,
    sklyarovSnap,
    "sales_manager",
    undefined,
    assignmentsScope,
  );
  assert.equal(scoped.length, 56, "real scope: 56 строк");

  const realDefaults = realInitialRopManagerDefaults(sklyarovSnap, "sales_manager");
  const pickerFiltered = applyDealerBasePickerFilters(scoped, {
    search: "",
    quick: "all",
    cities: [],
    categories: [],
    ropTeam: realDefaults.ropTeam,
    manager: realDefaults.manager,
    managerCatalogForRop: [],
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  });
  assert.equal(pickerFiltered.length, 56, "real picker all/all: 56");

  const myClientsRows = managerScopedRows(pickerFiltered, realDefaults.manager);
  assert.equal(myClientsRows.length, 56, "managerScopedRows all: 56 (Показано 56 из 56)");
}

console.log("dealer-base-initial-picker: ok");
