/**
 * Промт 392c — embed picker reset для viewingOtherUserScope.
 * Запуск: `npm run test:dealer-base-embed-scope` из каталога apps/platform.
 */
import { describe, it, expect } from "vitest";
import { applyDealerBasePickerFilters } from "../dealer-base-picker-filters.js";
import type { DealerRow } from "../dealer-base-mock-data.js";

describe("392c: embed picker reset для viewingOtherUserScope", () => {
  const mockRow: DealerRow = {
    id: "d1",
    name: "ИП Тест",
    city: "Краснодар",
    status: "активный",
    clientCategory: "B",
    manager: "Лысенко Екатерина Геннадьевна",
    releaseManagerId: "mgr-lysenko-eg",
    releaseTeamId: "team-skalaban",
    distribution: 50,
    outlets: 1,
    hasProblem: false,
    hasRecentActivity: true,
  } as DealerRow;

  it("когда ropTeam='all', строки с mock-releaseTeamId не режутся", () => {
    const out = applyDealerBasePickerFilters([mockRow], {
      search: "",
      quick: "all",
      cities: [],
      categories: [],
      ropTeam: "all",
      ropTeamLabel: undefined,
      manager: "all",
      managerCatalogForRop: [],
      geoRegion: "",
      geoDistrict: "",
      geoLocality: "",
    });
    expect(out.length).toBe(1);
  });

  it("Регрессия 392c: ropTeam=<UUID> режет mock-строки до фикса в dealer-base.tsx", () => {
    const out = applyDealerBasePickerFilters([mockRow], {
      search: "",
      quick: "all",
      cities: [],
      categories: [],
      ropTeam: "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa",
      ropTeamLabel: undefined,
      manager: "all",
      managerCatalogForRop: [],
      geoRegion: "",
      geoDistrict: "",
      geoLocality: "",
    });
    expect(out.length).toBe(0);
  });
});
