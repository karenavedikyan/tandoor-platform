/**
 * Запуск: `npm run test:city-concentration` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { buildCityConcentrationRows } from "../city-concentration.js";
import type { DealerRow } from "../dealer-base-mock-data.js";

function row(partial: Partial<DealerRow> & { id: string }): DealerRow {
  return {
    id: partial.id,
    name: partial.name ?? "Клиент",
    city: partial.city ?? "Москва",
    clientCategory: "top500",
    status: partial.status ?? "активный",
    format: "одиночный",
    outlets: partial.outlets ?? 2,
    manager: "М",
    regionalManager: "",
    ropName: "",
    lastActivity: "—",
    nextAction: "",
    distribution: 0,
    showcaseStatus: "—",
    hasProblem: partial.hasProblem ?? false,
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
  const rows = [row({ id: "d1", city: "Казань", outlets: 3 }), row({ id: "d2", city: "Казань", outlets: 1 })];
  const result = buildCityConcentrationRows(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.city, "Казань");
  assert.equal(result[0]!.total, 2);
  assert.equal(result[0]!.tradePoints, 4);
}

{
  const rows = [row({ id: "d1", city: "Воронеж", outlets: 5, status: "активный" })];
  const clientCountByCity = new Map([["Ростов-на-Дону", 10], ["Луганск", 3]]);
  const tradePointCountByCity = new Map([["Ростов-на-Дону", 12], ["Махачкала", 2]]);
  const result = buildCityConcentrationRows(rows, undefined, clientCountByCity, tradePointCountByCity);

  assert.equal(result.length, 3);
  assert.ok(!result.some((r) => r.city === "Воронеж"), "город только из rows не должен появляться");

  const rostov = result.find((r) => r.city === "Ростов-на-Дону");
  assert.ok(rostov);
  assert.equal(rostov!.total, 10);
  assert.equal(rostov!.tradePoints, 12);
  assert.equal(rostov!.active, 0);
  assert.equal(rostov!.pctActive, 0);

  const makhachkala = result.find((r) => r.city === "Махачкала");
  assert.ok(makhachkala);
  assert.equal(makhachkala!.total, 0);
  assert.equal(makhachkala!.tradePoints, 2);
  assert.equal(makhachkala!.active, 0);
}

{
  const rows = [
    row({ id: "d1", city: "Сочи", outlets: 9, status: "активный" }),
    row({ id: "d2", city: "Сочи", outlets: 1, status: "потенциальный", hasProblem: true }),
  ];
  const clientCountByCity = new Map([["Сочи", 4]]);
  const result = buildCityConcentrationRows(rows, undefined, clientCountByCity);

  const sochi = result.find((r) => r.city === "Сочи");
  assert.ok(sochi);
  assert.equal(sochi!.total, 4);
  assert.equal(sochi!.tradePoints, 0);
  assert.equal(sochi!.active, 1);
  assert.equal(sochi!.potential, 1);
  assert.equal(sochi!.attention, 1);
  assert.equal(sochi!.pctActive, 25);
  assert.equal(sochi!.pctAttention, 25);
}

{
  const clientCountByCity = new Map([["Пустой", 0]]);
  const result = buildCityConcentrationRows([], undefined, clientCountByCity);
  const empty = result.find((r) => r.city === "Пустой");
  assert.ok(empty);
  assert.equal(empty!.pctActive, 0);
  assert.equal(empty!.pctAttention, 0);
}

console.log("city-concentration: ok");
