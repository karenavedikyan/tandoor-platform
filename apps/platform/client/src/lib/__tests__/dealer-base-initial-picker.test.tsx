/**
 * Промт 407: initial ropTeam/manager из real-user profile, не DEFAULT Boyko.
 * Запуск: `npm run test:dealer-base-initial-picker` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data";
import { applyDealerBasePickerFilters } from "../dealer-base-picker-filters";
import { initialRopManagerForProfile } from "../dealer-base-role-views";
import { loadReleaseDemoProfile } from "../release-demo-profile";

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

// loadReleaseDemoProfile() без server user в node → Boyko (как старый init useState в SSR/первом кадре).
{
  const withoutUser = loadReleaseDemoProfile();
  assert.equal(withoutUser.personaUserId, "mgr-boyko-em");
}

// initialRopManagerForProfile для Склярова: команда + сам менеджер (целевой init из profile хука).
{
  const defaults = initialRopManagerForProfile(
    { role: "sales_manager", personaUserId: MGR_SLUG },
    "sales_manager",
  );
  assert.equal(defaults.ropTeam, TEAM_KUPIANSKY);
  assert.equal(defaults.manager, MGR_SLUG);
}

// Boyko defaults → 0 строк; Sklyarov defaults → 56.
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
  assert.equal(fixed.length, 56, "profile-based init (Скляров): 56 из 56");
}

console.log("dealer-base-initial-picker: ok");
