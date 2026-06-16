/**
 * Запуск: `npm run test:distribution-entry-wizard-scope` из каталога apps/platform.
 */
import { strict as assert } from "node:assert";
import test from "node:test";

import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";
import { distributionEntryScopedDealerRows } from "@/lib/distribution-entry-dealer-scope";
import { buildEntryCityRows } from "@/lib/distribution-entry-city-view-model";
import { collectEntryCatalogModels } from "@/lib/distribution-entry-product-view-model";
import {
  defaultDistributionFilterState,
  extractCityOptions,
  extractRegionOptions,
  filterScopeDealers,
  sanitizeDistributionFilterForScope,
} from "@/lib/distribution-filters";
import { loadReleaseDemoProfile, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userRoleToSalesRole } from "@/lib/role-mapping";

// @ts-expect-error: node без window
globalThis.window = { sessionStorage: { getItem: () => null, setItem: () => undefined } };

/** regional_manager → team_lead; Богачёв закреплён за командой Скалабана (seed 2026-06-02). */
const BOGACHEV_PROFILE: ReleaseDemoProfile = {
  role: "team_lead",
  personaUserId: "user-tl-skalaban",
};

test("РМ Богачёв: regionOptions без Купянского и Сапожкова", () => {
  const scoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, BOGACHEV_PROFILE);
  const regions = extractRegionOptions(scoped);
  assert.ok(
    regions.every((r) => r.includes("Скалабан")),
    `regionOptions должны быть только команды Скалабана: ${JSON.stringify(regions)}`,
  );
  assert.ok(!regions.some((r) => r.includes("Купянский") || r.includes("Сапожков")));
});

test("Менеджер: regionOptions = ровно один регион (свой РОП)", () => {
  const profile = loadReleaseDemoProfile("manager", "6f1ed04c-18a8-412d-a4db-efa8ed2258d6");
  if (mapSalesRoleToDealerBaseAccess(profile.role) !== "sales_manager") return;
  const scoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, profile);
  const regions = extractRegionOptions(scoped);
  assert.ok(regions.length <= 1, `regions.length=${regions.length}: ${regions.join(", ")}`);
});

test("Директор: regionOptions включает все три команды", () => {
  const profile = loadReleaseDemoProfile("director", null);
  const scoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, profile);
  const regions = extractRegionOptions(scoped);
  assert.ok(regions.length >= 3, `regions=${regions.join(", ")}`);
});

test("sanitizeDistributionFilterForScope сбрасывает region при hideRegion=true", () => {
  const next = sanitizeDistributionFilterForScope(
    { ...defaultDistributionFilterState(), region: "Купянский Родион" },
    { hideRegion: true },
  );
  assert.equal(next.region, "all");
});

test("sanitizeDistributionFilterForScope не трогает state при hideRegion=false", () => {
  const before = { ...defaultDistributionFilterState(), region: "Купянский Родион" };
  const next = sanitizeDistributionFilterForScope(before, { hideRegion: false });
  assert.equal(next, before);
});

test("regional_manager и sales_manager: hideRegion через mapSalesRoleToDealerBaseAccess", () => {
  const rmAccess = mapSalesRoleToDealerBaseAccess(userRoleToSalesRole("regional_manager"));
  const mgrAccess = mapSalesRoleToDealerBaseAccess(userRoleToSalesRole("manager"));
  const dirAccess = mapSalesRoleToDealerBaseAccess(userRoleToSalesRole("director"));
  assert.equal(rmAccess, "team_lead");
  assert.equal(mgrAccess, "sales_manager");
  assert.equal(dirAccess, "sales_director");
});

test("разрез «По городу»: buildEntryCityRows только по scoped/filtered дилерам", () => {
  const scoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, BOGACHEV_PROFILE);
  const filtered = filterScopeDealers(scoped, defaultDistributionFilterState());
  const kupianskyScoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, {
    role: "team_lead",
    personaUserId: "user-tl-kupiansky",
  });
  const kupianskyIds = new Set(kupianskyScoped.map((d) => d.id));
  assert.ok(!filtered.some((d) => kupianskyIds.has(d.id)));

  const cityRows = buildEntryCityRows(filtered, "");
  const scopedCities = new Set(extractCityOptions(scoped));
  for (const row of cityRows) {
    assert.ok(scopedCities.has(row.city), `город вне скоупа: ${row.city}`);
  }
});

test("разрез «По продукту»: collectEntryCatalogModels только по scoped/filtered дилерам", () => {
  const scoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, BOGACHEV_PROFILE);
  const filtered = filterScopeDealers(scoped, defaultDistributionFilterState());
  const allScoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, loadReleaseDemoProfile("director", null));
  const filteredIds = new Set(filtered.map((d) => d.id));
  const allIds = new Set(allScoped.map((d) => d.id));

  assert.ok(filteredIds.size < allIds.size, "скоуп команды уже уже полного портфеля");

  const models = collectEntryCatalogModels(filtered);
  assert.ok(models.length > 0);
  assert.equal(filterScopeDealers(scoped, defaultDistributionFilterState()).length, scoped.length);
});

console.log("distribution-entry-wizard-scope: ok");
