/**
 * Обезличенные показатели планов отдела продаж для кабинета менеджера.
 * МК и ВХ — в штуках, фурнитура — в обороте (₽). Структура готова к подмене данными API.
 */

export type SalesPlanCategory = "mk" | "vh" | "hardware";

export type SalesPlanMetric = {
  category: SalesPlanCategory;
  label: string;
  unit: "units" | "money";
  monthPlan: number;
  monthFact: number;
  monthForecast: number;
  previousMonthFact: number;
  previousYearSamePeriodFact: number;
};

export type SalesPlanComparison = {
  category: SalesPlanCategory;
  label: string;
  unit: "units" | "money";
  currentValue: number;
  previousValue: number;
  absoluteDelta: number;
  percentDelta: number;
  trend: "up" | "down" | "flat";
};

export type ManagerYearScenario = {
  scenario: "pessimistic" | "optimal" | "optimistic";
  label: string;
  mkPlanUnits: number;
  vhPlanUnits: number;
  hardwarePlanMoney: number;
  mkFactUnits: number;
  vhFactUnits: number;
  hardwareFactMoney: number;
  mkForecastUnits: number;
  vhForecastUnits: number;
  hardwareForecastMoney: number;
};

export type YearForecastSummary = {
  bandDescription: string;
  gapToOptimalDescription: string;
  managerHint: string;
};

export type ManagerPerformanceInsight = {
  id: string;
  text: string;
};

export type ProductLine = "ВХ" | "МК" | "Фурнитура";

export type TerritoryAnalytics = {
  territoryId: string;
  territoryLabel: string;
  salesRub: number;
  salesChangeVsPrevPercent: number;
  ordersCount: number;
  activeClients: number;
  avgOrderRub: number;
  grossRub: number;
};

export type CityAnalytics = {
  cityId: string;
  name: string;
  clientCount: number;
  partnerCategoriesLabel: string;
  shareInRegionPercent: number;
  salesRub: number;
  changeVsPrevPercent: number;
  vhUnits: number;
  mkUnits: number;
  /** Оборот по фурнитуре в рублях (не штуки) */
  hardwareTurnoverRub: number;
};

export type PartnerCategoryAnalytics = {
  key: "TOP" | "активные" | "потенциальные" | "без активности" | "требуют внимания";
  label: string;
  count: number;
  sharePercent: number;
  salesRub: number;
  changeVsPrevPercent: number;
};

export type ProductCategoryAnalytics = {
  line: ProductLine;
  metric: "units" | "money";
  plan: number;
  fact: number;
  changeVsPrevPercent: number;
  conversionPercent: number;
};

export type ProductTopItem = {
  productId: string;
  name: string;
  article: string;
  territorySalesRub: number;
  citySalesRub: number;
  /** Для дверей — штуки; для фурнитуры можно 0 и не показывать как шт. */
  territoryUnits: number | null;
  cityUnits: number | null;
  contributionPercent: number;
};

export type PartnerTopItem = {
  dealerId: string;
  name: string;
  city: string;
  salesRub: number;
  contributionPercent: number;
  conversionHint: string;
};

export type AnalyticsPlanSummary = {
  mkCompletionPercent: number;
  vhCompletionPercent: number;
  hardwareCompletionPercent: number;
  periodLabel: string;
};

export type AnalyticsViewMode = "summary" | "infographics";

export type InfographicPlanItem = {
  category: "mk" | "vh" | "hardware";
  label: string;
  unit: "units" | "money";
  plan: number;
  fact: number;
  forecast: number;
  completionPercent: number;
};

export type InfographicMonthlyPoint = {
  month: string;
  mkUnits: number;
  vhUnits: number;
  hardwareTurnoverRub: number;
};

export type InfographicYoYItem = {
  category: "mk" | "vh" | "hardware";
  label: string;
  unit: "units" | "money";
  currentValue: number;
  previousYearValue: number;
  absoluteDelta: number;
  percentDelta: number;
  trend: "up" | "down" | "flat";
};

export type InfographicCityItem = {
  id: string;
  city: string;
  clientsCount: number;
  regionSharePercent: number;
  topCategory: string;
  mkUnits: number;
  vhUnits: number;
  hardwareTurnoverRub: number;
};

export type InfographicTopItem = {
  id: string;
  name: string;
  category: "mk" | "vh" | "hardware";
  unit: "units" | "money";
  value: number;
  sharePercent: number;
};

export type HardwareConversionFunnelStep = {
  id: string;
  label: string;
  value: number;
  percent: number;
};

const MONTH_NAMES = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const SALES_PLAN_METRICS: SalesPlanMetric[] = [
  {
    category: "mk",
    label: "МК",
    unit: "units",
    monthPlan: 1240,
    monthFact: 798,
    monthForecast: 1188,
    previousMonthFact: 722,
    previousYearSamePeriodFact: 685,
  },
  {
    category: "vh",
    label: "ВХ",
    unit: "units",
    monthPlan: 428,
    monthFact: 266,
    monthForecast: 402,
    previousMonthFact: 248,
    previousYearSamePeriodFact: 239,
  },
  {
    category: "hardware",
    label: "Фурнитура",
    unit: "money",
    monthPlan: 3_420_000,
    monthFact: 2_080_000,
    monthForecast: 3_140_000,
    previousMonthFact: 1_960_000,
    previousYearSamePeriodFact: 1_820_000,
  },
];

const YEAR_SCENARIOS: ManagerYearScenario[] = [
  {
    scenario: "pessimistic",
    label: "Пессимистичный план",
    mkPlanUnits: 12_800,
    vhPlanUnits: 4_650,
    hardwarePlanMoney: 28_000_000,
    mkFactUnits: 6120,
    vhFactUnits: 2188,
    hardwareFactMoney: 14_200_000,
    mkForecastUnits: 12_400,
    vhForecastUnits: 4_420,
    hardwareForecastMoney: 26_800_000,
  },
  {
    scenario: "optimal",
    label: "Оптимальный план",
    mkPlanUnits: 15_200,
    vhPlanUnits: 5_520,
    hardwarePlanMoney: 34_200_000,
    mkFactUnits: 6120,
    vhFactUnits: 2188,
    hardwareFactMoney: 14_200_000,
    mkForecastUnits: 14_880,
    vhForecastUnits: 5_380,
    hardwareForecastMoney: 32_500_000,
  },
  {
    scenario: "optimistic",
    label: "Оптимистичный план",
    mkPlanUnits: 17_400,
    vhPlanUnits: 6_280,
    hardwarePlanMoney: 39_500_000,
    mkFactUnits: 6120,
    vhFactUnits: 2188,
    hardwareFactMoney: 14_200_000,
    mkForecastUnits: 16_200,
    vhForecastUnits: 5_840,
    hardwareForecastMoney: 35_100_000,
  },
];

export function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatCompactRub(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)} тыс. ₽`;
  return formatRub(n);
}

export function formatUnits(value: number): string {
  return `${value.toLocaleString("ru-RU")} шт.`;
}

export function formatMoney(value: number): string {
  return formatCompactRub(value);
}

/** value — число процентов (например 72 означает 72%). */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const s = Number.isInteger(rounded) ? String(Math.round(rounded)) : String(rounded).replace(".", ",");
  return `${s}%`;
}

export function getTrendLabel(trend: SalesPlanComparison["trend"]): string {
  if (trend === "up") return "Рост";
  if (trend === "down") return "Снижение";
  return "Без изменений";
}

export function getTrendColorClass(trend: SalesPlanComparison["trend"]): string {
  if (trend === "up") return "text-emerald-700";
  if (trend === "down") return "text-red-700";
  return "text-muted-foreground";
}

export function currentMonthPeriodLabel(): string {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function getSalesPlanMetrics(): SalesPlanMetric[] {
  return SALES_PLAN_METRICS;
}

function buildComparison(
  category: SalesPlanCategory,
  label: string,
  unit: "units" | "money",
  currentValue: number,
  previousValue: number,
): SalesPlanComparison {
  const absoluteDelta = currentValue - previousValue;
  let percentDelta = 0;
  if (previousValue !== 0) {
    percentDelta = (absoluteDelta / Math.abs(previousValue)) * 100;
  } else if (currentValue !== 0) {
    percentDelta = 100;
  }
  const trend: SalesPlanComparison["trend"] =
    Math.abs(percentDelta) < 0.6 ? "flat" : percentDelta > 0 ? "up" : "down";
  return {
    category,
    label,
    unit,
    currentValue,
    previousValue,
    absoluteDelta,
    percentDelta: Math.round(percentDelta * 10) / 10,
    trend,
  };
}

/** Текущий месяц vs предыдущий месяц (факт к факту). */
export function getMonthOverMonthComparisons(): SalesPlanComparison[] {
  return SALES_PLAN_METRICS.map((m) =>
    buildComparison(m.category, m.label, m.unit, m.monthFact, m.previousMonthFact),
  );
}

/** Текущий месяц (факт) vs аналогичный период прошлого года. */
export function getYearOverYearComparisons(): SalesPlanComparison[] {
  return SALES_PLAN_METRICS.map((m) =>
    buildComparison(m.category, m.label, m.unit, m.monthFact, m.previousYearSamePeriodFact),
  );
}

export function planCompletionPercent(plan: number, fact: number): number {
  if (plan <= 0) return 0;
  return Math.min(100, Math.round((fact / plan) * 100));
}

export function remainingToPlan(plan: number, fact: number): number {
  return Math.max(0, plan - fact);
}

export function getManagerYearScenarios(): ManagerYearScenario[] {
  return YEAR_SCENARIOS;
}

export function scenarioLineCompletion(plan: number, forecast: number): number {
  if (plan <= 0) return 0;
  return Math.round((forecast / plan) * 100);
}

export function getYearForecastSummary(): YearForecastSummary {
  return {
    bandDescription:
      "По текущей динамике вы находитесь между пессимистичным и оптимальным годовыми сценариями: прогноз по МК ближе к оптимальному, по ВХ — ниже оптимального коридора, по фурнитуре — между сценариями.",
    gapToOptimalDescription:
      "До оптимального сценария на конец года: МК — добрать около 320 шт. к прогнозу, ВХ — около 140 шт., фурнитура — около 1,7 млн ₽ оборота при сохранении темпа отгрузок.",
    managerHint:
      "Основной разрыв — ВХ к оптимальному сценарию; ближайший резерв — партнёры с активными заказами и точки с неполной матрицей.",
  };
}

export function getManagerPerformanceInsights(): ManagerPerformanceInsight[] {
  return [
    {
      id: "1",
      text: "МК идёт выше темпа прошлого месяца — важно удержать дисциплину отгрузок и не смещать фокус с подтверждённых заказов.",
    },
    {
      id: "2",
      text: "По ВХ есть отставание от месячного плана; ближайший резерв — клиенты с открытыми заказами и согласованными датами отгрузки.",
    },
    {
      id: "3",
      text: "Фурнитура растёт к прошлому месяцу, но годовой прогноз пока ниже оптимального сценария — усиление доли фурнитуры в заказах МК даст наибольший эффект для прогноза года.",
    },
  ];
}

export function getAnalyticsPlanSummary(): AnalyticsPlanSummary {
  const [mk, vh, hw] = SALES_PLAN_METRICS;
  return {
    mkCompletionPercent: planCompletionPercent(mk.monthPlan, mk.monthFact),
    vhCompletionPercent: planCompletionPercent(vh.monthPlan, vh.monthFact),
    hardwareCompletionPercent: planCompletionPercent(hw.monthPlan, hw.monthFact),
    periodLabel: currentMonthPeriodLabel(),
  };
}

const TERRITORY_ROWS: TerritoryAnalytics[] = [
  {
    territoryId: "south",
    territoryLabel: "Юг",
    salesRub: 42_600_000,
    salesChangeVsPrevPercent: 5.2,
    ordersCount: 1284,
    activeClients: 186,
    avgOrderRub: 198_400,
    grossRub: 38_900_000,
  },
  {
    territoryId: "center",
    territoryLabel: "Центр",
    salesRub: 36_200_000,
    salesChangeVsPrevPercent: 2.1,
    ordersCount: 942,
    activeClients: 154,
    avgOrderRub: 172_800,
    grossRub: 33_100_000,
  },
  {
    territoryId: "volga",
    territoryLabel: "Поволжье",
    salesRub: 28_900_000,
    salesChangeVsPrevPercent: -1.4,
    ordersCount: 710,
    activeClients: 121,
    avgOrderRub: 165_200,
    grossRub: 26_400_000,
  },
];

const CITY_ROWS: CityAnalytics[] = [
  {
    cityId: "krasnodar",
    name: "Краснодар",
    clientCount: 48,
    partnerCategoriesLabel: "TOP: 6 · активные: 28 · потенциальные: 14",
    shareInRegionPercent: 26,
    salesRub: 11_080_000,
    changeVsPrevPercent: 4.2,
    vhUnits: 128,
    mkUnits: 312,
    hardwareTurnoverRub: 4_120_000,
  },
  {
    cityId: "rostov",
    name: "Ростов-на-Дону",
    clientCount: 36,
    partnerCategoriesLabel: "TOP: 4 · активные: 22 · потенциальные: 10",
    shareInRegionPercent: 19,
    salesRub: 8_420_000,
    changeVsPrevPercent: 3.0,
    vhUnits: 96,
    mkUnits: 241,
    hardwareTurnoverRub: 3_280_000,
  },
  {
    cityId: "volgograd",
    name: "Волгоград",
    clientCount: 28,
    partnerCategoriesLabel: "TOP: 3 · активные: 17 · потенциальные: 8",
    shareInRegionPercent: 14,
    salesRub: 6_050_000,
    changeVsPrevPercent: -0.8,
    vhUnits: 74,
    mkUnits: 188,
    hardwareTurnoverRub: 2_410_000,
  },
  {
    cityId: "sochi",
    name: "Сочи",
    clientCount: 22,
    partnerCategoriesLabel: "TOP: 5 · активные: 12 · потенциальные: 5",
    shareInRegionPercent: 12,
    salesRub: 5_180_000,
    changeVsPrevPercent: 7.1,
    vhUnits: 88,
    mkUnits: 156,
    hardwareTurnoverRub: 2_060_000,
  },
];

const PARTNER_CAT_ROWS: PartnerCategoryAnalytics[] = [
  { key: "TOP", label: "TOP", count: 24, sharePercent: 8, salesRub: 14_200_000, changeVsPrevPercent: 5.4 },
  { key: "активные", label: "Активные", count: 118, sharePercent: 42, salesRub: 36_800_000, changeVsPrevPercent: 3.1 },
  { key: "потенциальные", label: "Потенциальные", count: 86, sharePercent: 31, salesRub: 12_400_000, changeVsPrevPercent: 1.8 },
  { key: "без активности", label: "Без активности", count: 38, sharePercent: 13, salesRub: 2_900_000, changeVsPrevPercent: -4.2 },
  { key: "требуют внимания", label: "Требуют внимания", count: 18, sharePercent: 6, salesRub: 4_600_000, changeVsPrevPercent: 0.6 },
];

const PRODUCT_CAT_ROWS: ProductCategoryAnalytics[] = [
  {
    line: "ВХ",
    metric: "units",
    plan: 2150,
    fact: 2048,
    changeVsPrevPercent: 4.0,
    conversionPercent: 22,
  },
  {
    line: "МК",
    metric: "units",
    plan: 6120,
    fact: 5890,
    changeVsPrevPercent: 2.3,
    conversionPercent: 41,
  },
  {
    line: "Фурнитура",
    metric: "money",
    plan: 12_000_000,
    fact: 9_800_000,
    changeVsPrevPercent: -1.1,
    conversionPercent: 29,
  },
];

const TOP_PRODUCTS: ProductTopItem[] = [
  {
    productId: "vh-grand-3",
    name: "Гранд 3",
    article: "VH-GRAND-3",
    territorySalesRub: 2_420_000,
    citySalesRub: 680_000,
    territoryUnits: 186,
    cityUnits: 52,
    contributionPercent: 5.7,
  },
  {
    productId: "mk-grand-3-mk",
    name: "Гранд 3 МК",
    article: "MK-GRAND-3",
    territorySalesRub: 1_980_000,
    citySalesRub: 540_000,
    territoryUnits: 312,
    cityUnits: 86,
    contributionPercent: 4.6,
  },
  {
    productId: "sk-line",
    name: "Скрытая дверь «Линия»",
    article: "SK-LINE",
    territorySalesRub: 1_260_000,
    citySalesRub: 410_000,
    territoryUnits: 420,
    cityUnits: 138,
    contributionPercent: 3.0,
  },
];

import { getReleaseClients } from "./release-client-data";

const TOP_PARTNER_METRICS: Omit<PartnerTopItem, "dealerId" | "name" | "city">[] = [
  {
    salesRub: 3_100_000,
    contributionPercent: 7.3,
    conversionHint: "Фурнитура: ниже целевого уровня на 6 п.п.",
  },
  {
    salesRub: 2_640_000,
    contributionPercent: 6.2,
    conversionHint: "ВХ стабильно, МК — окно для роста",
  },
  {
    salesRub: 2_180_000,
    contributionPercent: 5.1,
    conversionHint: "Топ по валовке в регионе",
  },
];

function buildTopPartnersFromRelease(): PartnerTopItem[] {
  const clients = getReleaseClients();
  const n = Math.max(clients.length, 1);
  return TOP_PARTNER_METRICS.map((m, i) => {
    const c = clients[i % n]!;
    return {
      dealerId: c.id,
      name: c.name,
      city: c.city || "—",
      ...m,
    };
  });
}

/** Обезличенная динамика по месяцам (региональный срез). */
const INFOGRAPHIC_MONTHLY: InfographicMonthlyPoint[] = [
  { month: "янв.", mkUnits: 980, vhUnits: 310, hardwareTurnoverRub: 2_650_000 },
  { month: "фев.", mkUnits: 1020, vhUnits: 298, hardwareTurnoverRub: 2_720_000 },
  { month: "мар.", mkUnits: 1105, vhUnits: 322, hardwareTurnoverRub: 2_880_000 },
  { month: "апр.", mkUnits: 1088, vhUnits: 305, hardwareTurnoverRub: 2_910_000 },
  { month: "май", mkUnits: 1150, vhUnits: 318, hardwareTurnoverRub: 3_050_000 },
  { month: "июн.", mkUnits: 1188, vhUnits: 330, hardwareTurnoverRub: 3_120_000 },
];

const HARDWARE_FUNNEL: HardwareConversionFunnelStep[] = [
  { id: "s1", label: "Клиенты с заказами в периоде", value: 186, percent: 100 },
  { id: "s2", label: "С позицией фурнитуры в заказе", value: 112, percent: 60 },
  { id: "s3", label: "С повторной фурнитурой в году", value: 48, percent: 26 },
  { id: "s4", label: "Итоговая конверсия воронки", value: 41, percent: 22 },
];

function productCategoryFromId(productId: string): "mk" | "vh" | "hardware" {
  if (productId.startsWith("vh-")) return "vh";
  if (productId.startsWith("mk-")) return "mk";
  if (productId.startsWith("sk-")) return "mk";
  return "hardware";
}

export function getAnalyticsInfographicPlanItems(): InfographicPlanItem[] {
  return SALES_PLAN_METRICS.map((m) => ({
    category: m.category,
    label: m.label,
    unit: m.unit,
    plan: m.monthPlan,
    fact: m.monthFact,
    forecast: m.monthForecast,
    completionPercent: planCompletionPercent(m.monthPlan, m.monthFact),
  }));
}

export function getAnalyticsMonthlyDynamics(): InfographicMonthlyPoint[] {
  return INFOGRAPHIC_MONTHLY;
}

export function getAnalyticsYoYItems(): InfographicYoYItem[] {
  return getYearOverYearComparisons().map((c) => ({
    category: c.category,
    label: c.label,
    unit: c.unit,
    currentValue: c.currentValue,
    previousYearValue: c.previousValue,
    absoluteDelta: c.absoluteDelta,
    percentDelta: c.percentDelta,
    trend: c.trend,
  }));
}

export function getAnalyticsInfographicCities(): InfographicCityItem[] {
  return CITY_ROWS.map((c) => ({
    id: c.cityId,
    city: c.name,
    clientsCount: c.clientCount,
    regionSharePercent: c.shareInRegionPercent,
    topCategory: c.partnerCategoriesLabel.includes("TOP") ? "TOP / активные" : "Активные / прочие",
    mkUnits: c.mkUnits,
    vhUnits: c.vhUnits,
    hardwareTurnoverRub: c.hardwareTurnoverRub,
  }));
}

export function getAnalyticsTopProductsTerritory(): InfographicTopItem[] {
  return TOP_PRODUCTS.map((p) => {
    const cat = productCategoryFromId(p.productId);
    const useUnits = (p.territoryUnits ?? 0) > 0;
    return {
      id: p.productId,
      name: p.name,
      category: cat,
      unit: useUnits ? "units" : "money",
      value: useUnits ? (p.territoryUnits as number) : p.territorySalesRub,
      sharePercent: p.contributionPercent,
    };
  });
}

export function getAnalyticsTopProductsCity(): InfographicTopItem[] {
  return TOP_PRODUCTS.map((p) => {
    const cat = productCategoryFromId(p.productId);
    const useUnits = (p.cityUnits ?? 0) > 0;
    return {
      id: `${p.productId}-city`,
      name: p.name,
      category: cat,
      unit: useUnits ? "units" : "money",
      value: useUnits ? (p.cityUnits as number) : p.citySalesRub,
      sharePercent: Math.round(p.contributionPercent * 0.72 * 10) / 10,
    };
  });
}

/** Топ партнёров для диаграмм инфографики (оборот, ₽). */
export function getAnalyticsTopPartners(): InfographicTopItem[] {
  return buildTopPartnersFromRelease().map((p) => ({
    id: p.dealerId,
    name: p.name,
    category: "hardware",
    unit: "money",
    value: p.salesRub,
    sharePercent: p.contributionPercent,
  }));
}

export function getHardwareConversionFunnel(): HardwareConversionFunnelStep[] {
  return HARDWARE_FUNNEL;
}

export type AnalyticsFilterState = {
  periodKey: "month" | "quarter" | "year";
  territoryId: string;
  cityId: string | "all";
  partnerCategoryKey: PartnerCategoryAnalytics["key"] | "all";
  productLine: ProductLine | "all";
};

export const ANALYTICS_PERIOD_OPTIONS = [
  { value: "month" as const, label: "Текущий месяц" },
  { value: "quarter" as const, label: "Квартал" },
  { value: "year" as const, label: "Год" },
];

export const ANALYTICS_TERRITORY_OPTIONS = TERRITORY_ROWS.map((t) => ({
  value: t.territoryId,
  label: t.territoryLabel,
}));

export const ANALYTICS_CITY_OPTIONS = [
  { value: "all" as const, label: "Все города" },
  ...CITY_ROWS.map((c) => ({ value: c.cityId as string, label: c.name })),
];

export const ANALYTICS_PARTNER_CATEGORY_OPTIONS = [
  { value: "all" as const, label: "Все категории" },
  ...PARTNER_CAT_ROWS.map((p) => ({ value: p.key, label: p.label })),
];

export const ANALYTICS_PRODUCT_LINE_OPTIONS = [
  { value: "all" as const, label: "Все линейки" },
  { value: "ВХ" as const, label: "ВХ" },
  { value: "МК" as const, label: "МК" },
  { value: "Фурнитура" as const, label: "Фурнитура" },
];

export function getTerritoryAnalytics(territoryId: string): TerritoryAnalytics {
  return TERRITORY_ROWS.find((t) => t.territoryId === territoryId) ?? TERRITORY_ROWS[0];
}

export function getCityAnalyticsRows(cityId: string | "all"): CityAnalytics[] {
  if (cityId === "all") return CITY_ROWS;
  return CITY_ROWS.filter((c) => c.cityId === cityId);
}

export function getPartnerCategoryRows(
  key: PartnerCategoryAnalytics["key"] | "all",
): PartnerCategoryAnalytics[] {
  if (key === "all") return PARTNER_CAT_ROWS;
  return PARTNER_CAT_ROWS.filter((p) => p.key === key);
}

export function getProductCategoryRows(line: ProductLine | "all"): ProductCategoryAnalytics[] {
  if (line === "all") return PRODUCT_CAT_ROWS;
  return PRODUCT_CAT_ROWS.filter((p) => p.line === line);
}

export function getTopProducts(): ProductTopItem[] {
  return TOP_PRODUCTS;
}

export function getTopPartners(): PartnerTopItem[] {
  return buildTopPartnersFromRelease();
}

export function analyticsPeriodSuffix(periodKey: AnalyticsFilterState["periodKey"]): string {
  if (periodKey === "quarter") return "за квартал";
  if (periodKey === "year") return "за год";
  return "за месяц";
}
