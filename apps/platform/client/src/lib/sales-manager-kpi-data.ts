/**
 * Обезличенные показатели плана и аналитики для кабинета менеджера.
 * Структура рассчитана на последующую подмену ответами API (1С, Bitrix и др.).
 */

export type ManagerMonthlyKpi = {
  periodLabel: string;
  planRub: number;
  factRub: number;
  forecastRub: number;
  completionPercent: number;
  status: "в норме" | "требует внимания" | "риск";
  remainingToPlanRub: number;
};

export type ManagerGrossSales = {
  grossRub: number;
  units: number;
  vsPrevMonthPercent: number;
  avgOrderRub: number;
  activePartners: number;
};

export type ProductLine = "ВХ" | "МК" | "Фурнитура";

export type ManagerCategoryKpi = {
  line: ProductLine;
  planRub: number;
  factRub: number;
  forecastRub: number;
  completionPercent: number;
  units: number;
  grossRub: number;
  status: "в норме" | "требует внимания" | "риск";
};

export type ManagerHardwareConversion = {
  ordersWithHardwareSharePercent: number;
  clientConversionPercent: number;
  plannedConversionPercent: number;
  actualConversionPercent: number;
  diffPercent: number;
  hint: string;
};

export type RankingPeer = {
  place: number;
  name: string;
  scoreLabel: string;
  scoreValue: number;
};

export type ManagerRanking = {
  place: number;
  totalManagers: number;
  metricLabel: string;
  ownScore: number;
  gapToNextAbove: number | null;
  gapToNextBelow: number | null;
  topThree: RankingPeer[];
};

export type ManagerMonthTask = {
  taskId: string;
  title: string;
  status: "новая" | "в работе" | "ожидает" | "выполнена";
  progressPercent: number;
  kpiImpact: string;
  deadline: string;
  relatedLabel: string;
};

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
  hardwareUnits: number;
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
  salesRub: number;
  units: number;
  planRub: number;
  factRub: number;
  changeVsPrevPercent: number;
  conversionPercent: number;
};

export type ProductTopItem = {
  productId: string;
  name: string;
  article: string;
  territorySalesRub: number;
  citySalesRub: number;
  units: number;
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

export function currentMonthPeriodLabel(): string {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function getManagerMonthlyKpi(): ManagerMonthlyKpi {
  const planRub = 18_400_000;
  const factRub = 11_250_000;
  const forecastRub = 17_100_000;
  const completionPercent = Math.round((factRub / planRub) * 100);
  const remainingToPlanRub = Math.max(0, planRub - factRub);
  const forecastRatio = forecastRub / planRub;
  const status: ManagerMonthlyKpi["status"] =
    forecastRatio >= 0.98 ? "в норме" : forecastRatio >= 0.92 ? "требует внимания" : "риск";
  return {
    periodLabel: currentMonthPeriodLabel(),
    planRub,
    factRub,
    forecastRub,
    completionPercent,
    status,
    remainingToPlanRub,
  };
}

export function getManagerGrossSales(): ManagerGrossSales {
  return {
    grossRub: 14_680_000,
    units: 1840,
    vsPrevMonthPercent: 6.4,
    avgOrderRub: 186_500,
    activePartners: 42,
  };
}

export function getManagerCategoryKpis(): ManagerCategoryKpi[] {
  return [
    {
      line: "ВХ",
      planRub: 6_200_000,
      factRub: 3_980_000,
      forecastRub: 5_910_000,
      completionPercent: 64,
      units: 412,
      grossRub: 5_020_000,
      status: "требует внимания",
    },
    {
      line: "МК",
      planRub: 8_800_000,
      factRub: 5_640_000,
      forecastRub: 8_450_000,
      completionPercent: 64,
      units: 1188,
      grossRub: 7_210_000,
      status: "требует внимания",
    },
    {
      line: "Фурнитура",
      planRub: 3_400_000,
      factRub: 1_630_000,
      forecastRub: 2_740_000,
      completionPercent: 48,
      units: 9560,
      grossRub: 2_450_000,
      status: "риск",
    },
  ];
}

export function categoryTestId(line: ProductLine): string {
  if (line === "ВХ") return "card-manager-category-vh";
  if (line === "МК") return "card-manager-category-mk";
  return "card-manager-category-hardware";
}

export function getManagerHardwareConversion(): ManagerHardwareConversion {
  return {
    ordersWithHardwareSharePercent: 38,
    clientConversionPercent: 27,
    plannedConversionPercent: 35,
    actualConversionPercent: 27,
    diffPercent: -8,
    hint: "Усилить предложение фурнитуры в заказах МК и при отгрузке ВХ — быстрый вклад в валовку.",
  };
}

export function getManagerRanking(): ManagerRanking {
  return {
    place: 4,
    totalManagers: 18,
    metricLabel: "выполнение плана по валовке, %",
    ownScore: 61,
    gapToNextAbove: 2.4,
    gapToNextBelow: 1.1,
    topThree: [
      { place: 1, name: "Смирнов А.В.", scoreLabel: "план, %", scoreValue: 108 },
      { place: 2, name: "Козлова Е.С.", scoreLabel: "план, %", scoreValue: 97 },
      { place: 3, name: "Иванов Д.К.", scoreLabel: "план, %", scoreValue: 89 },
    ],
  };
}

export function getManagerMonthTasks(): ManagerMonthTask[] {
  return [
    {
      taskId: "month-task-vh",
      title: "Добрать ВХ до планового коридора",
      status: "в работе",
      progressPercent: 64,
      kpiImpact: "до +6 п.п. к выполнению плана",
      deadline: "18.05.2026",
      relatedLabel: "ВХ · ключевые партнёры",
    },
    {
      taskId: "month-task-mk",
      title: "Добрать МК по сетевым точкам",
      status: "в работе",
      progressPercent: 58,
      kpiImpact: "до +4 п.п. к выполнению плана",
      deadline: "22.05.2026",
      relatedLabel: "МК · сеть «Север»",
    },
    {
      taskId: "month-task-hardware",
      title: "Поднять долю фурнитуры в заказах",
      status: "ожидает",
      progressPercent: 32,
      kpiImpact: "до +3 п.п. к валовке",
      deadline: "28.05.2026",
      relatedLabel: "Фурнитура · все активные",
    },
    {
      taskId: "month-task-inactive",
      title: "Вернуть клиентов без активности",
      status: "новая",
      progressPercent: 12,
      kpiImpact: "стабилизация базы",
      deadline: "25.05.2026",
      relatedLabel: "7 партнёров в зоне",
    },
    {
      taskId: "month-task-overdue",
      title: "Закрыть просроченные согласования",
      status: "в работе",
      progressPercent: 45,
      kpiImpact: "ускорение отгрузок",
      deadline: "12.05.2026",
      relatedLabel: "Заказы · оплата и отгрузка",
    },
    {
      taskId: "month-task-tops",
      title: "Отработать TOP по витрине и матрице",
      status: "в работе",
      progressPercent: 71,
      kpiImpact: "рост среднего заказа",
      deadline: "20.05.2026",
      relatedLabel: "TOP · витрина и дистрибуция",
    },
  ];
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
    hardwareUnits: 1840,
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
    hardwareUnits: 1520,
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
    hardwareUnits: 1210,
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
    hardwareUnits: 980,
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
    salesRub: 19_200_000,
    units: 2156,
    planRub: 20_000_000,
    factRub: 19_200_000,
    changeVsPrevPercent: 4.0,
    conversionPercent: 22,
  },
  {
    line: "МК",
    salesRub: 28_400_000,
    units: 6120,
    planRub: 30_500_000,
    factRub: 28_400_000,
    changeVsPrevPercent: 2.3,
    conversionPercent: 41,
  },
  {
    line: "Фурнитура",
    salesRub: 9_800_000,
    units: 48_200,
    planRub: 12_000_000,
    factRub: 9_800_000,
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
    units: 186,
    contributionPercent: 5.7,
  },
  {
    productId: "mk-grand-3-mk",
    name: "Гранд 3 МК",
    article: "MK-GRAND-3",
    territorySalesRub: 1_980_000,
    citySalesRub: 540_000,
    units: 312,
    contributionPercent: 4.6,
  },
  {
    productId: "sk-line",
    name: "Скрытая дверь «Линия»",
    article: "SK-LINE",
    territorySalesRub: 1_260_000,
    citySalesRub: 410_000,
    units: 8420,
    contributionPercent: 3.0,
  },
];

const TOP_PARTNERS: PartnerTopItem[] = [
  {
    dealerId: "002",
    name: "Дилер №002",
    city: "Ростов-на-Дону",
    salesRub: 3_100_000,
    contributionPercent: 7.3,
    conversionHint: "Фурнитура: ниже целевого уровня на 6 п.п.",
  },
  {
    dealerId: "001",
    name: "Дилер №001",
    city: "Краснодар",
    salesRub: 2_640_000,
    contributionPercent: 6.2,
    conversionHint: "ВХ стабильно, МК — окно для роста",
  },
  {
    dealerId: "004",
    name: "Дилер №004",
    city: "Волгоград",
    salesRub: 2_180_000,
    contributionPercent: 5.1,
    conversionHint: "Топ по валовке в регионе",
  },
];

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
  return TOP_PARTNERS;
}

export function analyticsPeriodSuffix(periodKey: AnalyticsFilterState["periodKey"]): string {
  if (periodKey === "quarter") return "за квартал";
  if (periodKey === "year") return "за год";
  return "за месяц";
}
