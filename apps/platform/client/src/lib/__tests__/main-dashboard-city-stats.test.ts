import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import {
  buildMainDashboardCityTiles,
  dealerRowMatchesCityFilter,
  displayCityForDealerRow,
  filterCityTilesBySearch,
} from "../main-dashboard-city-stats";
import type { DealerRow, DealerTradePoint } from "../dealer-base-mock-data";

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

function tp(id: string): DealerTradePoint {
  return {
    id,
    name: "ТТ",
    city: "Краснодар",
    address: "ул. 1",
    format: "магазин",
    status: "активная",
    equipment: "",
    hardwareStockStatus: "",
    doorsStockStatus: "",
    distribution: { mk: 0, vh: 0, total: 0 },
    showcaseStatus: "",
    showcaseNeeds: "",
    lastVisitDate: "",
    nextVisitDate: "",
    responsibleRegionalManager: "",
    issues: "",
    tasks: [],
    activityHistory: [],
    photos: { attached: false },
  };
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

// ТТ на плитке — из row.tradePoints (БД-scope), а не из пустого runtime act.
{
  const emptyAct = createEmptyActualizationState();
  const tiles = buildMainDashboardCityTiles(
    [
      row({ id: "a", city: "Воронеж", tradePoints: [tp("tp-a")] }),
      row({ id: "b", city: "Воронеж", tradePoints: [tp("tp-b")] }),
    ],
    emptyAct,
  );
  const voronezh = tiles.find((t) => t.city === "Воронеж");
  assert.equal(voronezh?.activeClients, 2);
  assert.equal(voronezh?.activeTradePoints, 2, "TP count from row.tradePoints even when act is empty");
}

console.log("main-dashboard-city-stats: ok");
