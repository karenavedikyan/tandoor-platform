/**
 * Операционные таблицы аналитики (обратная связь 07.05.26).
 * Обезличенные агрегаты и синтетические строки поверх клиентской базы и каталога.
 */

import { getClientCategoryOptions, isClientTopTier, type ClientCategoryId } from "@/lib/client-category";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import { CATALOG_PRODUCTS, type CatalogProduct } from "@/lib/catalog-data";

export type PartnerSegment = "top500" | "fiveHundredPlus" | "tandoorClub";

/** Линейка для фильтров операционного блока (согласовано с селектами аналитики). */
export type OperationalProductLineKey = "all" | "mk" | "vh" | "hardware";

export type OperationalShowcaseZone = "A" | "B" | "C";

export type OperationalAnalyticsTab =
  | "top500"
  | "fiveHundredPlus"
  | "tandoorClub"
  | "showcaseProfitability"
  | "hardwareConversion"
  | "equipment";

export type ShowcaseCheckStatus = "verified" | "needs_check" | "no_data";

export type ShowcaseModelRef = {
  productId: string;
  label: string;
  line: "mk" | "vh" | "hardware";
};

export type OperationalClientShowcaseRow = {
  dealerId: string;
  clientName: string;
  city: string;
  clientCategory: ClientCategoryId;
  /** Клиент может одновременно входить в несколько операционных сегментов (вкладки не взаимоисключающие). */
  segments: PartnerSegment[];
  mkModels: ShowcaseModelRef[];
  vhModels: ShowcaseModelRef[];
  hardwareModels: ShowcaseModelRef[];
  unitsOnShowcase: number;
  checkDate: string;
  setupDate: string;
  totalSales: number;
  showcaseSales: number;
  conversionPercent: number;
  showcaseCheckStatus: ShowcaseCheckStatus;
};

export type ShowcaseAttentionZone = "high_profit" | "low_profit" | "many_competitors" | "no_showcase_sales";

export type OperationalShowcaseProfitabilityRow = {
  rowKey: string;
  dealerId: string;
  tradePointId?: string;
  clientName: string;
  city: string;
  clientCategory: ClientCategoryId;
  ourShowcases: number;
  competitorShowcases: number;
  totalSales: number;
  showcaseSales: number;
  profitabilityLabel: string;
  profitabilityScore: number;
  shareShowcasePercent: number;
  attentionZone: ShowcaseAttentionZone;
};

export type HardwareConversionLevel = "high" | "medium" | "low" | "none";

export type OperationalHardwareConversionRow = {
  dealerId: string;
  clientName: string;
  city: string;
  clientCategory: ClientCategoryId;
  mkSales: number;
  hardwareSales: number;
  conversionPercent: number;
  competitorsSummary: string;
  topCompetitorModels: string;
  reasonNotWithUs: string;
  worksUnderStock: boolean;
  ourEquipment: boolean;
  conversionLevel: HardwareConversionLevel;
};

export type OperationalEquipmentRow = {
  equipmentId: string;
  dealerId: string;
  clientName: string;
  city: string;
  nomenclature: string;
  quantity: number;
  amountRub: number;
  realizationDate: string;
  avgMonthlyOrderRub: number;
  contractDocLabel: string;
};

export type OperationalGlobalFilters = {
  periodKey: "month" | "quarter" | "year";
  territoryId: string;
  cityId: string;
  dealerCategory: ClientCategoryId | "all";
  productLine: OperationalProductLineKey;
  search: string;
};

export const OPERATIONAL_DEFAULT_GLOBAL_FILTERS: OperationalGlobalFilters = {
  periodKey: "month",
  territoryId: "south",
  cityId: "all",
  dealerCategory: "all",
  productLine: "all",
  search: "",
};

/**
 * Раньше сегмент выбирался одним значением с приоритетом Club → TOP, из‑за чего все TOP-клиенты
 * (в сгенерированных строках они же «Участник» Club) попадали только во вкладку Club, а «ТОП 500» оставался пустым.
 * Явное множество сегментов: TOP — всегда «ТОП 500», Club — «Tandoor Club», «500+» — все не‑TOP.
 */
function computeDealerSegments(d: DealerRow): PartnerSegment[] {
  const s = new Set<PartnerSegment>();
  if (isClientTopTier(d.clientCategory)) s.add("top500");
  if (d.terms.tandoorClub === "Участник") s.add("tandoorClub");
  if (!isClientTopTier(d.clientCategory)) s.add("fiveHundredPlus");
  return Array.from(s);
}

function productLine(p: CatalogProduct): "mk" | "vh" | "hardware" {
  if (p.category.toLowerCase().includes("фурнитур") || p.id.includes("sk-")) return "hardware";
  if (p.doorKind.includes("Вход")) return "vh";
  return "mk";
}

function pickModels(dealerIndex: number, count: number): ShowcaseModelRef[] {
  const out: ShowcaseModelRef[] = [];
  const n = CATALOG_PRODUCTS.length;
  for (let k = 0; k < count; k += 1) {
    const p = CATALOG_PRODUCTS[(dealerIndex * 5 + k * 3) % n]!;
    out.push({
      productId: p.id,
      label: p.name,
      line: productLine(p),
    });
  }
  return out;
}

function checkStatus(i: number): ShowcaseCheckStatus {
  if (i % 3 === 0) return "verified";
  if (i % 3 === 1) return "needs_check";
  return "no_data";
}

function buildClientShowcaseRow(d: DealerRow, i: number): OperationalClientShowcaseRow {
  const refs = pickModels(parseInt(d.id, 10) || i, 5);
  const mkModels = refs.filter((r) => r.line === "mk").slice(0, 3);
  const vhModels = refs.filter((r) => r.line === "vh").slice(0, 3);
  const hardwareModels = refs.filter((r) => r.line === "hardware").slice(0, 2);
  const totalSales = 120 + (i * 37) % 900;
  const showcaseSales = Math.round(totalSales * (0.18 + ((i * 7) % 40) / 100));
  const conversionPercent = Math.min(95, Math.round((showcaseSales / Math.max(1, totalSales)) * 100));
  return {
    dealerId: d.id,
    clientName: d.name,
    city: d.city,
    clientCategory: d.clientCategory,
    segments: computeDealerSegments(d),
    mkModels,
    vhModels,
    hardwareModels,
    unitsOnShowcase: 4 + (i % 9),
    checkDate: `${3 + (i % 20)}.05.2026`,
    setupDate: `${12 + (i % 15)}.03.2026`,
    totalSales,
    showcaseSales,
    conversionPercent,
    showcaseCheckStatus: checkStatus(i),
  };
}

export function buildOperationalClientShowcaseRowsFromDealers(dealers: DealerRow[]): OperationalClientShowcaseRow[] {
  return dealers.map((d, i) => buildClientShowcaseRow(d, i));
}

/** Срезы операционной аналитики по клиентской базе (синтетика поверх `DealerRow[]`). */
export type OperationalAnalyticsRowSlices = {
  clientShowcase: OperationalClientShowcaseRow[];
  showcaseProfit: OperationalShowcaseProfitabilityRow[];
  hardware: OperationalHardwareConversionRow[];
  equipment: OperationalEquipmentRow[];
};

export function buildOperationalAnalyticsRowSlicesFromDealers(dealers: DealerRow[]): OperationalAnalyticsRowSlices {
  return {
    clientShowcase: buildOperationalClientShowcaseRowsFromDealers(dealers),
    showcaseProfit: buildShowcaseProfitRowsFromDealers(dealers),
    hardware: buildHardwareRowsFromDealers(dealers),
    equipment: buildEquipmentRowsFromDealers(dealers),
  };
}

const STATIC_OPERATIONAL_ROW_SLICES = buildOperationalAnalyticsRowSlicesFromDealers(DEALER_BASE_ROWS);

function cityNameFromFilter(cityId: string): string | null {
  if (cityId === "all") return null;
  const map: Record<string, string> = {
    krasnodar: "Краснодар",
    rostov: "Ростов-на-Дону",
    volgograd: "Волгоград",
    sochi: "Сочи",
  };
  return map[cityId] ?? null;
}

function territoryKeepsDealer(territoryId: string, dealerId: string): boolean {
  const n = parseInt(dealerId, 10) || 0;
  if (territoryId === "south") return true;
  if (territoryId === "center") return n % 2 === 0;
  if (territoryId === "volga") return n % 2 === 1;
  return true;
}

function mapProductLineFilter(line: OperationalProductLineKey): "mk" | "vh" | "hardware" | null {
  if (line === "all") return null;
  return line;
}

function rowMatchesProductLine(row: OperationalClientShowcaseRow, line: OperationalProductLineKey): boolean {
  const want = mapProductLineFilter(line);
  if (!want) return true;
  if (want === "mk") return row.mkModels.length > 0;
  if (want === "vh") return row.vhModels.length > 0;
  return row.hardwareModels.length > 0;
}

function matchesSearch(row: OperationalClientShowcaseRow, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const inClient = row.clientName.toLowerCase().includes(s);
  const inCity = row.city.toLowerCase().includes(s);
  const inModels = [...row.mkModels, ...row.vhModels, ...row.hardwareModels].some((m) => m.label.toLowerCase().includes(s));
  return inClient || inCity || inModels;
}

export function filterClientShowcaseRows(
  segment: PartnerSegment,
  filters: OperationalGlobalFilters,
  showcaseStatus: ShowcaseCheckStatus | "all",
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): OperationalClientShowcaseRow[] {
  const cityName = cityNameFromFilter(filters.cityId);
  return slices.clientShowcase.filter((row) => {
    if (!row.segments.includes(segment)) return false;
    if (!territoryKeepsDealer(filters.territoryId, row.dealerId)) return false;
    if (cityName && row.city !== cityName) return false;
    if (filters.dealerCategory !== "all" && row.clientCategory !== filters.dealerCategory) return false;
    if (!rowMatchesProductLine(row, filters.productLine)) return false;
    if (showcaseStatus !== "all" && row.showcaseCheckStatus !== showcaseStatus) return false;
    if (!matchesSearch(row, filters.search)) return false;
    return true;
  });
}

export function kpiForClientShowcase(rows: OperationalClientShowcaseRow[]) {
  const clients = rows.length;
  const models = rows.reduce((s, r) => s + r.mkModels.length + r.vhModels.length + r.hardwareModels.length, 0);
  const showcaseSales = rows.reduce((s, r) => s + r.showcaseSales, 0);
  const avgConv = clients ? Math.round(rows.reduce((s, r) => s + r.conversionPercent, 0) / clients) : 0;
  return { clients, models, showcaseSales, avgConv };
}

export function kpiForProfitabilityRows(rows: OperationalShowcaseProfitabilityRow[]) {
  const clients = new Set(rows.map((r) => r.dealerId)).size;
  const showcaseSlots = rows.reduce((s, r) => s + r.ourShowcases, 0);
  const showcaseSales = rows.reduce((s, r) => s + r.showcaseSales, 0);
  const avgShare = rows.length ? Math.round(rows.reduce((s, r) => s + r.shareShowcasePercent, 0) / rows.length) : 0;
  return { clients, showcaseSlots, showcaseSales, avgShare };
}

function attentionFromDealer(d: DealerRow, idx: number): ShowcaseAttentionZone {
  if (d.hasProblem) return "many_competitors";
  if (d.distribution < 45) return "no_showcase_sales";
  if (d.distribution > 78) return "high_profit";
  if (idx % 5 === 2) return "low_profit";
  return "high_profit";
}

function buildShowcaseProfitRowsFromDealers(dealers: DealerRow[]): OperationalShowcaseProfitabilityRow[] {
  return dealers.flatMap((d, i) => {
    const base = (parseInt(d.id, 10) || 1) * 1000;
  const totalSales = 200 + (i * 41) % 800;
  const showcaseSales = Math.round(totalSales * (0.15 + ((i * 3) % 35) / 100));
  const share = Math.round((showcaseSales / Math.max(1, totalSales)) * 100);
  const score = 40 + (i * 13) % 55;
  const label = score >= 70 ? "Высокая" : score >= 45 ? "Средняя" : "Низкая";
  const out: OperationalShowcaseProfitabilityRow[] = [
    {
      rowKey: `${d.id}`,
      dealerId: d.id,
      tradePointId: undefined,
      clientName: d.name,
      city: d.city,
      clientCategory: d.clientCategory,
      ourShowcases: d.tradePoints.length,
      competitorShowcases: 1 + (i % 5),
      totalSales,
      showcaseSales,
      profitabilityLabel: label,
      profitabilityScore: score,
      shareShowcasePercent: share,
      attentionZone: attentionFromDealer(d, i),
    },
  ];
    if (d.tradePoints[1]) {
      const tp = d.tradePoints[1];
      out.push({
        rowKey: `${d.id}-${tp.id}`,
        dealerId: d.id,
        tradePointId: tp.id,
        clientName: `${d.name} · ${tp.name}`,
        city: tp.city,
        clientCategory: d.clientCategory,
        ourShowcases: 1,
        competitorShowcases: i % 4,
        totalSales: Math.round(totalSales * 0.35),
        showcaseSales: Math.round(showcaseSales * 0.3),
        profitabilityLabel: score >= 55 ? "Средняя" : "Низкая",
        profitabilityScore: Math.max(30, score - 12),
        shareShowcasePercent: Math.min(100, share + 5),
        attentionZone: i % 2 === 0 ? "many_competitors" : "low_profit",
      });
    }
    return out;
  });
}

export function filterShowcaseProfitabilityRows(
  filters: OperationalGlobalFilters,
  attention: ShowcaseAttentionZone | "all",
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): OperationalShowcaseProfitabilityRow[] {
  const cityName = cityNameFromFilter(filters.cityId);
  return slices.showcaseProfit.filter((row) => {
    if (!territoryKeepsDealer(filters.territoryId, row.dealerId)) return false;
    if (cityName && row.city !== cityName) return false;
    if (filters.dealerCategory !== "all" && row.clientCategory !== filters.dealerCategory) return false;
    if (attention !== "all" && row.attentionZone !== attention) return false;
    if (!matchesSearchShowcase(row, filters.search)) return false;
    return true;
  });
}

function matchesSearchShowcase(row: OperationalShowcaseProfitabilityRow, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  return row.clientName.toLowerCase().includes(s) || row.city.toLowerCase().includes(s);
}

function buildHardwareRowsFromDealers(dealers: DealerRow[]): OperationalHardwareConversionRow[] {
  return dealers.map((d, i) => {
    const mkSales = 40 + (i * 17) % 220;
  const hw = Math.round(mkSales * (0.08 + ((i * 5) % 25) / 100));
  const conv = mkSales > 0 ? Math.round((hw / mkSales) * 100) : 0;
  let level: HardwareConversionLevel = "medium";
  if (conv >= 22) level = "high";
  else if (conv < 10) level = "low";
    if (hw === 0) level = "none";
    return {
      dealerId: d.id,
      clientName: d.name,
      city: d.city,
      clientCategory: d.clientCategory,
      mkSales,
      hardwareSales: hw,
      conversionPercent: conv,
      competitorsSummary: i % 5 === 0 ? "" : i % 2 === 0 ? "Две сильные линейки у конкурентов" : "Точечные замены у локальных поставщиков",
      topCompetitorModels: i % 3 === 0 ? "Серия X, серия Y" : "Серия Z",
      reasonNotWithUs:
        i % 4 === 0
          ? "Ожидание по срокам поставки"
          : i % 4 === 1
            ? "Ценовой коридор"
            : "Нет выделенной зоны фурнитуры",
      worksUnderStock: i % 3 !== 0,
      ourEquipment: i % 5 !== 0,
      conversionLevel: level,
    };
  });
}

export function filterHardwareRows(
  filters: OperationalGlobalFilters,
  conv: HardwareConversionLevel | "all",
  hasCompetitors: boolean | null,
  hasOurEquipment: boolean | null,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): OperationalHardwareConversionRow[] {
  const cityName = cityNameFromFilter(filters.cityId);
  return slices.hardware.filter((row) => {
    if (!territoryKeepsDealer(filters.territoryId, row.dealerId)) return false;
    if (cityName && row.city !== cityName) return false;
    if (filters.dealerCategory !== "all" && row.clientCategory !== filters.dealerCategory) return false;
    if (conv !== "all" && row.conversionLevel !== conv) return false;
    if (hasCompetitors === true && !row.competitorsSummary.trim()) return false;
    if (hasOurEquipment === true && !row.ourEquipment) return false;
    if (!matchesSearchHw(row, filters.search)) return false;
    return true;
  });
}

function matchesSearchHw(row: OperationalHardwareConversionRow, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  return row.clientName.toLowerCase().includes(s) || row.city.toLowerCase().includes(s) || row.topCompetitorModels.toLowerCase().includes(s);
}

export function kpiHardware(rows: OperationalHardwareConversionRow[]) {
  const mk = rows.reduce((s, r) => s + r.mkSales, 0);
  const hw = rows.reduce((s, r) => s + r.hardwareSales, 0);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.conversionPercent, 0) / rows.length) : 0;
  const low = rows.filter((r) => r.conversionLevel === "low" || r.conversionLevel === "none").length;
  return { mk, hw, avg, low };
}

function buildEquipmentRowsFromDealers(dealers: DealerRow[]): OperationalEquipmentRow[] {
  return dealers.flatMap((d, i) => {
    const lines = [
    { nom: "Стенд выкладки МК", qty: 1 + (i % 2), rub: 180_000 + (i % 7) * 22_000 },
    { nom: "Комплект демонстрационных образцов", qty: 2 + (i % 3), rub: 96_000 + (i % 5) * 14_000 },
  ];
    return lines.map((line, j) => ({
      equipmentId: `eq-${d.id}-${j + 1}`,
      dealerId: d.id,
      clientName: d.name,
      city: d.city,
      nomenclature: line.nom,
      quantity: line.qty,
      amountRub: line.rub,
      realizationDate: `${8 + ((i + j) % 20)}.04.2026`,
      avgMonthlyOrderRub: 420_000 + ((i + j) % 12) * 35_000,
      contractDocLabel: `Договор поставки №${d.id}-EQ-${j + 1}`,
    }));
  });
}

export type EquipmentPeriodFilter = "all" | "q1" | "q2";

export function filterEquipmentRows(
  filters: OperationalGlobalFilters,
  dealerId: string | "all",
  nomenclature: string,
  period: EquipmentPeriodFilter,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): OperationalEquipmentRow[] {
  const cityName = cityNameFromFilter(filters.cityId);
  return slices.equipment.filter((row) => {
    if (!territoryKeepsDealer(filters.territoryId, row.dealerId)) return false;
    if (cityName && row.city !== cityName) return false;
    if (dealerId !== "all" && row.dealerId !== dealerId) return false;
    if (nomenclature.trim() && !row.nomenclature.toLowerCase().includes(nomenclature.trim().toLowerCase())) return false;
    if (period !== "all") {
      const m = parseInt(row.realizationDate.split(".")[1] ?? "4", 10);
      if (period === "q1" && m > 3) return false;
      if (period === "q2" && (m < 4 || m > 6)) return false;
    }
    if (filters.search.trim()) {
      const s = filters.search.trim().toLowerCase();
      if (!row.clientName.toLowerCase().includes(s) && !row.nomenclature.toLowerCase().includes(s)) return false;
    }
    return true;
  });
}

export function kpiEquipment(rows: OperationalEquipmentRow[]) {
  const units = rows.reduce((s, r) => s + r.quantity, 0);
  const sum = rows.reduce((s, r) => s + r.amountRub, 0);
  const clients = new Set(rows.map((r) => r.dealerId)).size;
  const avgM = rows.length ? Math.round(rows.reduce((s, r) => s + r.avgMonthlyOrderRub, 0) / rows.length) : 0;
  return { units, sum, clients, avgM };
}

export const DEALER_CATEGORY_FILTER_OPTIONS: { value: ClientCategoryId | "all"; label: string }[] =
  getClientCategoryOptions();

export const OPERATIONAL_PRODUCT_LINE_OPTIONS: { value: OperationalProductLineKey; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "mk", label: "МК" },
  { value: "vh", label: "ВХ" },
  { value: "hardware", label: "Фурнитура" },
];

/** Все клиенты витрин по глобальным фильтрам (без фильтра по сегменту). */
export function filterClientShowcaseRowsAllSegments(
  filters: OperationalGlobalFilters,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): OperationalClientShowcaseRow[] {
  const cityName = cityNameFromFilter(filters.cityId);
  return slices.clientShowcase.filter((row) => {
    if (!territoryKeepsDealer(filters.territoryId, row.dealerId)) return false;
    if (cityName && row.city !== cityName) return false;
    if (filters.dealerCategory !== "all" && row.clientCategory !== filters.dealerCategory) return false;
    if (!rowMatchesProductLine(row, filters.productLine)) return false;
    if (!matchesSearch(row, filters.search)) return false;
    return true;
  });
}

const CITY_SLUG_FOR_INFOGRAPHIC: Record<string, string> = {
  Краснодар: "krasnodar",
  "Ростов-на-Дону": "rostov",
  Сочи: "sochi",
  Волгоград: "volgograd",
  Ставрополь: "stavropol",
  Астрахань: "astrakhan",
};

export function citySlugForInfographic(cityName: string): string {
  return CITY_SLUG_FOR_INFOGRAPHIC[cityName] ?? `city-${cityName.length}-${cityName.charCodeAt(0) ?? 0}`;
}

export type InfographicClientSegmentCard = {
  segment: PartnerSegment;
  label: string;
  clients: number;
  modelsOnShowcase: number;
  showcaseSales: number;
  avgConversionPercent: number;
};

export function getInfographicClientSegmentCards(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): InfographicClientSegmentCard[] {
  const labels: Record<PartnerSegment, string> = {
    top500: "ТОП 500",
    fiveHundredPlus: "500+",
    tandoorClub: "Tandoor Club",
  };
  const order: PartnerSegment[] = ["top500", "fiveHundredPlus", "tandoorClub"];
  return order.map((segment) => {
    const rows = filterClientShowcaseRows(segment, filters, "all", slices);
    const k = kpiForClientShowcase(rows);
    return {
      segment,
      label: labels[segment],
      clients: k.clients,
      modelsOnShowcase: k.models,
      showcaseSales: k.showcaseSales,
      avgConversionPercent: k.avgConv,
    };
  });
}

export type InfographicProfitabilityBar = {
  dealerId: string;
  clientName: string;
  city: string;
  profitabilityLabel: string;
  profitabilityScore: number;
  shareShowcasePercent: number;
  ourShowcases: number;
  competitorShowcases: number;
};

export function getInfographicShowcaseProfitabilityBars(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  limit = 10,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): InfographicProfitabilityBar[] {
  const rows = filterShowcaseProfitabilityRows(filters, "all", slices);
  const byDealer = new Map<string, OperationalShowcaseProfitabilityRow>();
  for (const r of rows) {
    if (!r.tradePointId) byDealer.set(r.dealerId, r);
  }
  return Array.from(byDealer.values())
    .sort((a, b) => a.profitabilityScore - b.profitabilityScore)
    .slice(0, limit)
    .map((r) => ({
      dealerId: r.dealerId,
      clientName: r.clientName,
      city: r.city,
      profitabilityLabel: r.profitabilityLabel,
      profitabilityScore: r.profitabilityScore,
      shareShowcasePercent: r.shareShowcasePercent,
      ourShowcases: r.ourShowcases,
      competitorShowcases: r.competitorShowcases,
    }));
}

export function getInfographicShowcaseRiskClients(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  limit = 6,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): OperationalShowcaseProfitabilityRow[] {
  const rows = filterShowcaseProfitabilityRows(filters, "all", slices);
  const risky = rows.filter((r) => r.attentionZone !== "high_profit");
  const seen = new Set<string>();
  const out: OperationalShowcaseProfitabilityRow[] = [];
  for (const r of risky) {
    if (seen.has(r.dealerId)) continue;
    seen.add(r.dealerId);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

export function getInfographicHardwareOperationalKpi(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
) {
  const rows = filterHardwareRows(filters, "all", null, null, slices);
  return kpiHardware(rows);
}

export function getInfographicHardwareRiskClients(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  limit = 5,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): OperationalHardwareConversionRow[] {
  const rows = filterHardwareRows(filters, "all", null, null, slices).filter(
    (r) => r.conversionLevel === "low" || r.conversionLevel === "none",
  );
  const seen = new Set<string>();
  const out: OperationalHardwareConversionRow[] = [];
  for (const r of rows) {
    if (seen.has(r.dealerId)) continue;
    seen.add(r.dealerId);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

export type InfographicEquipmentNomenclatureBar = { name: string; quantity: number; amountRub: number };

export function getInfographicEquipmentNomenclatureBars(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): InfographicEquipmentNomenclatureBar[] {
  const rows = filterEquipmentRows(filters, "all", "", "all", slices);
  const map = new Map<string, { quantity: number; amountRub: number }>();
  for (const r of rows) {
    const cur = map.get(r.nomenclature) ?? { quantity: 0, amountRub: 0 };
    cur.quantity += r.quantity;
    cur.amountRub += r.amountRub;
    map.set(r.nomenclature, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, quantity: v.quantity, amountRub: v.amountRub }))
    .sort((a, b) => b.amountRub - a.amountRub);
}

export type InfographicEquipmentClientCard = {
  dealerId: string;
  clientName: string;
  city: string;
  amountRub: number;
  quantity: number;
  avgMonthlyOrderRub: number;
};

export function getInfographicEquipmentTopClients(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  limit = 6,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): InfographicEquipmentClientCard[] {
  const rows = filterEquipmentRows(filters, "all", "", "all", slices);
  const byDealer = new Map<string, InfographicEquipmentClientCard>();
  for (const r of rows) {
    const cur =
      byDealer.get(r.dealerId) ??
      ({
        dealerId: r.dealerId,
        clientName: r.clientName,
        city: r.city,
        amountRub: 0,
        quantity: 0,
        avgMonthlyOrderRub: r.avgMonthlyOrderRub,
      } satisfies InfographicEquipmentClientCard);
    cur.amountRub += r.amountRub;
    cur.quantity += r.quantity;
    cur.avgMonthlyOrderRub = r.avgMonthlyOrderRub;
    byDealer.set(r.dealerId, cur);
  }
  return Array.from(byDealer.values()).sort((a, b) => b.amountRub - a.amountRub).slice(0, limit);
}

export type InfographicCitySegment = {
  cityId: string;
  cityName: string;
  clients: number;
  /** ТОП 150 / 350 / 500 / 500+ */
  shareTopTiersPercent: number;
  sharePotentialPercent: number;
  shareLeadPercent: number;
  /** Б/П, без категории и прочие бизнес-метки */
  shareOtherClientCategoryPercent: number;
  shareTop500Percent: number;
  shareFiveHundredPlusPercent: number;
  shareClubPercent: number;
  showcaseSales: number;
  avgConversionPercent: number;
};

function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

export function getInfographicCitySegments(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): InfographicCitySegment[] {
  const rows = filterClientShowcaseRowsAllSegments(filters, slices);
  const byCity = new Map<string, OperationalClientShowcaseRow[]>();
  for (const r of rows) {
    const arr = byCity.get(r.city) ?? [];
    arr.push(r);
    byCity.set(r.city, arr);
  }
  const out: InfographicCitySegment[] = [];
  for (const [cityName, list] of Array.from(byCity.entries())) {
    const n = list.length;
    let topTier = 0;
    let pot = 0;
    let lead = 0;
    for (const r of list) {
      if (isClientTopTier(r.clientCategory)) topTier += 1;
      else if (r.clientCategory === "potential") pot += 1;
      else if (r.clientCategory === "lead") lead += 1;
    }
    const other = Math.max(0, n - topTier - pot - lead);
    const seg = (s: PartnerSegment) => list.filter((r: OperationalClientShowcaseRow) => r.segments.includes(s)).length;
    const showcaseSales = list.reduce((s: number, r: OperationalClientShowcaseRow) => s + r.showcaseSales, 0);
    const avgConversion = n ? Math.round(list.reduce((s, r) => s + r.conversionPercent, 0) / n) : 0;
    out.push({
      cityId: citySlugForInfographic(cityName),
      cityName,
      clients: n,
      shareTopTiersPercent: pct(topTier, n),
      sharePotentialPercent: pct(pot, n),
      shareLeadPercent: pct(lead, n),
      shareOtherClientCategoryPercent: pct(other, n),
      shareTop500Percent: pct(seg("top500"), n),
      shareFiveHundredPlusPercent: pct(seg("fiveHundredPlus"), n),
      shareClubPercent: pct(seg("tandoorClub"), n),
      showcaseSales,
      avgConversionPercent: avgConversion,
    });
  }
  return out.sort((a, b) => b.showcaseSales - a.showcaseSales);
}

export type InfographicShowcaseModelRow = {
  productId: string;
  label: string;
  line: "mk" | "vh";
  clientCount: number;
  showcaseSales: number;
  avgConversionPercent: number;
  unitsOnShowcase: number;
};

export function getInfographicShowcaseModels(
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  line: "mk" | "vh",
  limit = 8,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): InfographicShowcaseModelRow[] {
  const rows = filterClientShowcaseRowsAllSegments(filters, slices);
  type Agg = { label: string; clients: Set<string>; sales: number; convSum: number; convN: number; units: number };
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const models = line === "mk" ? r.mkModels : r.vhModels;
    const denom = Math.max(1, models.length);
    for (const m of models) {
      const cur =
        map.get(m.productId) ??
        ({
          label: m.label,
          clients: new Set<string>(),
          sales: 0,
          convSum: 0,
          convN: 0,
          units: 0,
        } satisfies Agg);
      cur.clients.add(r.dealerId);
      cur.sales += r.showcaseSales / denom;
      cur.convSum += r.conversionPercent;
      cur.convN += 1;
      cur.units += r.unitsOnShowcase / denom;
      map.set(m.productId, cur);
    }
  }
  return Array.from(map.entries())
    .map(([productId, v]) => ({
      productId,
      label: v.label,
      line,
      clientCount: v.clients.size,
      showcaseSales: Math.round(v.sales),
      avgConversionPercent: v.convN ? Math.round(v.convSum / v.convN) : 0,
      unitsOnShowcase: Math.round(v.units),
    }))
    .sort((a, b) => b.showcaseSales - a.showcaseSales)
    .slice(0, limit);
}

/** Первая ТТ с отдельной строкой рентабельности — для ссылок «к точке» из аналитики. */
export function getProfitabilityTradePointIdForDealer(
  dealerId: string,
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): string | undefined {
  const row = filterShowcaseProfitabilityRows(filters, "all", slices).find(
    (r) => r.dealerId === dealerId && r.tradePointId,
  );
  return row?.tradePointId;
}

/** Первая позиция фурнитуры на витрине клиента — для ссылки в блоке конверсии. */
export function getHardwareProductIdForDealer(
  dealerId: string,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): string | undefined {
  return slices.clientShowcase.find((r) => r.dealerId === dealerId)?.hardwareModels[0]?.productId;
}

/** Первая строка оборудования клиента (для диалога «договор»). */
export function getFirstEquipmentRowForDealer(
  dealerId: string,
  filters: OperationalGlobalFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  slices: OperationalAnalyticsRowSlices = STATIC_OPERATIONAL_ROW_SLICES,
): OperationalEquipmentRow | undefined {
  return filterEquipmentRows(filters, "all", "", "all", slices).find((r) => r.dealerId === dealerId);
}
