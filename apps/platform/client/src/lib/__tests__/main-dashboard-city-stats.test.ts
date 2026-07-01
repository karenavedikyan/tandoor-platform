import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import {
  buildClientCountByCityFromScopedDb,
  buildMainDashboardCityTiles,
  buildTradePointCountByCityFromScopedDb,
  dealerRowMatchesCityFilter,
  displayCityForDealerRow,
  filterCityTilesBySearch,
} from "../main-dashboard-city-stats";
import type { ScopedTradePointDto } from "../trade-points-scoped-api";
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

function scopedTp(partial: Partial<ScopedTradePointDto> & { id: string; dealerId: string }): ScopedTradePointDto {
  return {
    externalKey: partial.id,
    name: "ТТ",
    city: "Ростов-на-Дону",
    address: null,
    format: null,
    isActive: true,
    isPrimary: false,
    importanceTier: null,
    dealerExternalKey: partial.dealerId,
    dealerName: "Дилер",
    dealerReleaseCode: null,
    dealerCity: null,
    dealerClientCategory: null,
    managerUserId: null,
    managerFullName: null,
    regionalManagerUserId: null,
    regionalManagerFullName: null,
    teamId: null,
    teamName: null,
    ropUserId: null,
    ropFullName: null,
    ...partial,
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

// ТТ на плитке — из БД-карты scoped API, а не из row.tradePoints.
{
  const dbTpMap = new Map([["Воронеж", 5]]);
  const tiles = buildMainDashboardCityTiles(
    [
      row({ id: "a", city: "Воронеж", tradePoints: [tp("tp-a")] }),
      row({ id: "b", city: "Воронеж", tradePoints: [tp("tp-b")] }),
    ],
    act,
    dbTpMap,
  );
  const voronezh = tiles.find((t) => t.city === "Воронеж");
  assert.equal(voronezh?.activeClients, 2);
  assert.equal(voronezh?.activeTradePoints, 5, "TP count from scoped DB map overrides row.tradePoints");
}

// buildTradePointCountByCityFromScopedDb: активные ТТ, неактивные не считаются.
{
  const dto = (partial: Partial<ScopedTradePointDto> & { externalKey: string }): ScopedTradePointDto => ({
    id: partial.id ?? partial.externalKey,
    externalKey: partial.externalKey,
    name: "ТТ",
    city: partial.city ?? null,
    address: null,
    format: null,
    isActive: partial.isActive ?? true,
    isPrimary: false,
    importanceTier: null,
    dealerId: "d1",
    dealerExternalKey: "d1",
    dealerName: "Клиент",
    dealerReleaseCode: null,
    dealerCity: partial.dealerCity ?? partial.city ?? null,
    dealerClientCategory: null,
    managerUserId: null,
    managerFullName: null,
    regionalManagerUserId: null,
    regionalManagerFullName: null,
    teamId: null,
    teamName: null,
    ropUserId: null,
    ropFullName: null,
  });
  const map = buildTradePointCountByCityFromScopedDb([
    dto({ externalKey: "tp-1", dealerCity: "Новороссийск" }),
    dto({ externalKey: "tp-2", dealerCity: "Новороссийск" }),
    dto({ externalKey: "tp-3", dealerCity: "Геленджик" }),
    dto({ externalKey: "tp-off", dealerCity: "Новороссийск", isActive: false }),
  ]);
  assert.equal(map.get("Новороссийск"), 2);
  assert.equal(map.get("Геленджик"), 1);
}

// Scoped БД: клиенты и ТТ из одного источника, город только в БД.
{
  const scoped = [
    scopedTp({ id: "tp-1", dealerId: "d-1", city: "Ростов-на-Дону" }),
    scopedTp({ id: "tp-2", dealerId: "d-2", city: "Ростов-на-Дону" }),
    scopedTp({ id: "tp-3", dealerId: "d-3", city: "Луганск" }),
    scopedTp({ id: "tp-4", dealerId: "d-4", city: "Луганск", isActive: false }),
  ];
  const clientCountByCity = buildClientCountByCityFromScopedDb(scoped);
  const tradePointCountByCity = buildTradePointCountByCityFromScopedDb(scoped);
  assert.equal(clientCountByCity.get("Ростов-на-Дону"), 2);
  assert.equal(tradePointCountByCity.get("Ростов-на-Дону"), 2);
  assert.equal(clientCountByCity.get("Луганск"), 1, "inactive TP still counts dealer once");
  assert.equal(tradePointCountByCity.get("Луганск"), 1, "inactive TP excluded from TP count");

  const tiles = buildMainDashboardCityTiles(
    [row({ id: "legacy", city: "Воронеж", tradePoints: [tp("legacy-tp")] })],
    act,
    tradePointCountByCity,
    clientCountByCity,
  );
  assert.equal(tiles.some((t) => t.city === "Воронеж"), false, "legacy rows ignored when clientCountByCity set");
  const rostov = tiles.find((t) => t.city === "Ростов-на-Дону");
  assert.equal(rostov?.activeClients, 2);
  assert.equal(rostov?.activeTradePoints, 2);
  const luhansk = tiles.find((t) => t.city === "Луганск");
  assert.equal(luhansk?.activeClients, 1);
  assert.equal(luhansk?.activeTradePoints, 1);
}

console.log("main-dashboard-city-stats: ok");
