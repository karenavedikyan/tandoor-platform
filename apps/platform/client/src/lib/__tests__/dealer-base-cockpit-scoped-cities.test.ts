/**
 * Запуск: `npm run test:dealer-base-cockpit-scoped-cities` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  buildOverviewCityCardsFromDb,
  buildOverviewCityCardsFromScopedDb,
  overviewWithoutCityFromScopedDb,
  resolveCockpitDistributionBar,
} from "../dealer-base-management-view-model.js";
import type { ClientBaseOverview } from "../client-base-overview-api.js";
import type { TradePointDistributionAggregateResult } from "@/hooks/use-trade-point-distribution-aggregate";

const overviewFromActualization: ClientBaseOverview = {
  success: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  structure: {
    activeClients: 10,
    tradePoints: 10,
    potentialClients: 0,
    attentionClients: 0,
    averageDistributionPct: 0,
    avgTpPerClient: 1,
    managersWithClientsWithoutTp: 0,
    citiesWithClientsWithoutTp: 0,
  },
  topActiveClients: [],
  cities: [{ city: "Воронеж", clients: 25, tradePoints: 6 }],
  withoutCity: { clients: 0, tradePoints: 0 },
  ropGroups: [],
};

{
  const fromOverview = buildOverviewCityCardsFromDb(overviewFromActualization);
  assert.equal(fromOverview[0]!.displayName, "Воронеж");
  assert.equal(fromOverview[0]!.activeClients, 25);
}

{
  const clientCountByCity = new Map([
    ["Ростов-на-Дону", 35],
    ["Луганск", 30],
    ["Без города", 2],
  ]);
  const tradePointCountByCity = new Map([
    ["Ростов-на-Дону", 35],
    ["Луганск", 31],
    ["Без города", 2],
  ]);

  const cards = buildOverviewCityCardsFromScopedDb(clientCountByCity, tradePointCountByCity);
  assert.equal(cards.length, 2);
  assert.ok(!cards.some((c) => c.displayName === "Воронеж"));
  assert.ok(!cards.some((c) => c.displayName === "Без города"));
  assert.equal(cards[0]!.displayName, "Ростов-на-Дону");
  assert.equal(cards[0]!.activeClients, 35);
  assert.equal(cards[0]!.tradePoints, 35);
  assert.equal(cards[1]!.displayName, "Луганск");
  assert.equal(cards[1]!.tradePoints, 31);

  const noCity = overviewWithoutCityFromScopedDb(clientCountByCity, tradePointCountByCity);
  assert.ok(noCity);
  assert.equal(noCity!.activeClients, 2);
  assert.equal(noCity!.tradePoints, 2);
}

const emptyAggregate = {
  byType: {
    entrance: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
  },
  averagePercent: null,
  rotationPotentialPercent: null,
  totalLegacyOurs: 0,
  tradePointsCount: 0,
};

function distResult(
  tradePointsCount: number,
  loading: boolean,
): TradePointDistributionAggregateResult {
  return { aggregate: { ...emptyAggregate, tradePointsCount }, tradePointsCount, loading };
}

{
  const scoped = distResult(458, false);
  const local = distResult(0, false);
  const fromScoped = resolveCockpitDistributionBar(scoped, local, true);
  assert.equal(fromScoped.distribution.tradePointsCount, 458);
  assert.equal(fromScoped.loading, false);

  const fromLocal = resolveCockpitDistributionBar(undefined, local, true);
  assert.equal(fromLocal.distribution.tradePointsCount, 0);
  assert.equal(fromLocal.loading, false);

  const idsNotReady = resolveCockpitDistributionBar(scoped, local, false);
  assert.equal(idsNotReady.distribution.tradePointsCount, 458);
  assert.equal(idsNotReady.loading, false);

  const idsNotReadyEmpty = resolveCockpitDistributionBar(distResult(0, true), local, false);
  assert.equal(idsNotReadyEmpty.loading, true);

  const scopedLoading = resolveCockpitDistributionBar(distResult(458, true), local, true);
  assert.equal(scopedLoading.loading, true);
}

console.log("dealer-base-cockpit-scoped-cities: ok");
