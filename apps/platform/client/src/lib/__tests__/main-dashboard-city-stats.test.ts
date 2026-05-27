import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import {
  buildMainDashboardCityTiles,
  dealerRowMatchesCityFilter,
  displayCityForDealerRow,
  filterCityTilesBySearch,
} from "../main-dashboard-city-stats";
import type { DealerRow } from "../dealer-base-mock-data";

const act = createEmptyActualizationState();

function row(partial: Partial<DealerRow> & { id: string; city?: string }): DealerRow {
  return {
    id: partial.id,
    name: partial.name ?? "Клиент",
    city: partial.city ?? "Москва",
    clientCategory: "top500",
    status: "активный",
    format: "одиночный",
    outlets: 2,
    manager: "М",
    regionalManager: "",
    ropName: "",
    lastActivity: "—",
    nextAction: "",
    distribution: 0,
    showcaseStatus: "—",
    hasProblem: false,
    comment: "",
    hasRecentActivity: true,
    legalEntity: "",
    holding: "",
    tradePoints: [],
    responsibles: { director: "", salesManager: "", regionalManager: "", assistant: "" },
    contacts: { lpr: "", buyer: "", phone: "", email: "" },
    terms: { payment: "", discount: "", bonus: "", tandoorClub: "" },
    ...partial,
  } as DealerRow;
}

{
  const tiles = buildMainDashboardCityTiles(
    [row({ id: "a", city: "Краснодар" }), row({ id: "b", city: "Краснодар" }), row({ id: "c", city: "" })],
    act,
  );
  const kras = tiles.find((t) => t.city === "Краснодар");
  const none = tiles.find((t) => t.city === "Без города");
  assert.equal(kras?.activeClients, 2);
  assert.equal(none?.activeClients, 1);
  assert.equal(tiles[tiles.length - 1]?.city, "Без города");
}

{
  const r = row({ id: "x", city: "  " });
  assert.equal(displayCityForDealerRow(r), "Без города");
  assert.equal(dealerRowMatchesCityFilter(r, "Без города"), true);
}

{
  const tiles = buildMainDashboardCityTiles([row({ id: "a", city: "Краснодар" }), row({ id: "b", city: "Красноярск" })], act);
  const found = filterCityTilesBySearch(tiles, "крас");
  assert.equal(found.length, 2);
}

console.log("main-dashboard-city-stats: ok");
