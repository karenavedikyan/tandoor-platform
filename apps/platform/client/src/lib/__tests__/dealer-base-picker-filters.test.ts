/**
 * Запуск: `npm run test:dealer-base-picker-filters` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { applyDealerBasePickerFilters, type DealerBasePickerArgs } from "../dealer-base-picker-filters";
import type { DealerRow } from "../dealer-base-mock-data";

function row(partial: Partial<DealerRow> & Pick<DealerRow, "id">): DealerRow {
  return {
    id: partial.id,
    name: partial.name ?? "Test",
    city: partial.city ?? "Город",
    manager: partial.manager ?? "Менеджер",
    status: partial.status ?? "активный",
    outlets: partial.outlets ?? 1,
    distribution: partial.distribution ?? 50,
    hasProblem: partial.hasProblem ?? false,
    hasRecentActivity: partial.hasRecentActivity ?? true,
    clientCategory: partial.clientCategory ?? "B",
    releaseTeamId: partial.releaseTeamId ?? "team-kupiansky",
    releaseManagerId: partial.releaseManagerId ?? "mgr-sklyarov-dv",
    ...partial,
  } as DealerRow;
}

const baseArgs: DealerBasePickerArgs = {
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
};

// manager=all не отсекает строки.
{
  const rows = [
    row({ id: "a", releaseManagerId: "mgr-sklyarov-dv", releaseTeamId: "team-kupiansky" }),
    row({ id: "b", releaseManagerId: "mgr-kulakova-os", releaseTeamId: "team-skalaban" }),
  ];
  const out = applyDealerBasePickerFilters(rows, baseArgs);
  assert.equal(out.length, 2, "manager=all возвращает все переданные строки");
}

// UUID менеджера в picker отсекает catalog-id (регрессия hotfix 54-pre-A).
{
  const rows = [row({ id: "a", releaseManagerId: "mgr-sklyarov-dv" })];
  const out = applyDealerBasePickerFilters(rows, {
    ...baseArgs,
    manager: "dc958e02-d80e-4615-bb8a-8a46be70daed",
  });
  assert.equal(out.length, 0, "UUID manager без маппера отсекает catalog releaseManagerId");
}

console.log("dealer-base-picker-filters: ok (2 cases)");
