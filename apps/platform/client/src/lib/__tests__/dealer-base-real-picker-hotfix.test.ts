/**
 * Запуск: `npm run test:dealer-base-real-picker-hotfix` из каталога apps/platform.
 *
 * Интеграция: roleScopedDealerRowsForReal + applyDealerBasePickerFilters с real defaults.
 */
import assert from "node:assert/strict";
import { applyDealerBasePickerFilters, type DealerBasePickerArgs } from "../dealer-base-picker-filters";
import { roleScopedDealerRowsForReal } from "../dealer-base-real-scope";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { getReleaseClients } from "../release-client-data";
import { realInitialRopManagerDefaults } from "../real-org-adapter";
import { getSalesUserById } from "../sales-control-data";
import type { OrgSnapshot } from "../use-org-snapshot";

const SKLYAROV_UUID = "dc958e02-d80e-4615-bb8a-8a46be70daed";
const KULAKOVA_UUID = "6f1ed04c-18a8-412d-a4db-efa8ed2258d6";
const LYSENKO_UUID = "9e6056c9-9c8c-477b-94fd-45dab490e382";
const TEAM_KUPIANSKY_UUID = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";

function snapForManager(uuid: string, catalogMgrId: string): OrgSnapshot {
  const u = getSalesUserById(catalogMgrId);
  const fullName = u?.name ?? catalogMgrId;
  const teamId = u?.teamId ?? "";
  return {
    me: { id: uuid, role: "manager", fullName, teamId },
    visibility: { all: true, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [{ id: uuid, role: "manager", fullName, teamId }],
  } as unknown as OrgSnapshot;
}

function pickerFilteredCount(snap: OrgSnapshot, access: "sales_manager"): number {
  const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());
  const scoped = roleScopedDealerRowsForReal(allRows, snap, access);
  const defaults = realInitialRopManagerDefaults(snap, access);
  const args: DealerBasePickerArgs = {
    search: "",
    quick: "all",
    cities: [],
    categories: [],
    ropTeam: defaults.ropTeam,
    manager: defaults.manager,
    managerCatalogForRop: [],
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  };
  return applyDealerBasePickerFilters(scoped, args).length;
}

{
  const snap = snapForManager(SKLYAROV_UUID, "mgr-sklyarov-dv");
  const n = pickerFilteredCount(snap, "sales_manager");
  assert.ok(n >= 40, `Скляров: после hotfix pickerFiltered >= 40 (got ${n})`);
}

{
  const snap = snapForManager(KULAKOVA_UUID, "mgr-kulakova-os");
  const n = pickerFilteredCount(snap, "sales_manager");
  assert.ok(n >= 200, `Кулакова: pickerFiltered >= 200 (got ${n})`);
}

{
  const snap = snapForManager(LYSENKO_UUID, "mgr-lysenko-eg");
  const n = pickerFilteredCount(snap, "sales_manager");
  assert.ok(n >= 150, `Лысенко: pickerFiltered >= 150 (got ${n})`);
}

// Регрессия: старые UUID-дефолты обнуляли список.
{
  const snap = snapForManager(SKLYAROV_UUID, "mgr-sklyarov-dv");
  const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());
  const scoped = roleScopedDealerRowsForReal(allRows, snap, "sales_manager");
  assert.ok(scoped.length >= 40, "scopedRows для Склярова непустой");
  const broken = applyDealerBasePickerFilters(scoped, {
    search: "",
    quick: "all",
    cities: [],
    categories: [],
    ropTeam: "e5387f40-c693-44e6-ab17-e61a3ed0bd95",
    manager: SKLYAROV_UUID,
    managerCatalogForRop: [],
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  });
  assert.equal(broken.length, 0, "UUID picker defaults отсекают все строки (до hotfix)");
}

// РОП: UUID teamId + ropTeamLabel (ФИО из org snapshot) — fallback по ropName строки.
{
  const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());
  const baseArgs = {
    search: "",
    quick: "all" as const,
    cities: [] as string[],
    categories: [] as DealerBasePickerArgs["categories"],
    manager: "all",
    managerCatalogForRop: [] as DealerBasePickerArgs["managerCatalogForRop"],
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  };
  const withoutLabel = applyDealerBasePickerFilters(allRows, {
    ...baseArgs,
    ropTeam: TEAM_KUPIANSKY_UUID,
  });
  assert.equal(withoutLabel.length, 0, "РОП UUID без ropTeamLabel — 0 строк (catalog id не совпадает)");

  const withLabel = applyDealerBasePickerFilters(allRows, {
    ...baseArgs,
    ropTeam: TEAM_KUPIANSKY_UUID,
    ropTeamLabel: "Купянский",
  });
  assert.ok(
    withLabel.length >= 600,
    `РОП UUID + ropTeamLabel: команда Купянский >= 600 (got ${withLabel.length})`,
  );
}

console.log("dealer-base-real-picker-hotfix: ok (5 cases)");
