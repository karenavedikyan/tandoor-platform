/**
 * Локальный каталог моделей для платформы.
 * Структура полей согласована с типичным каталогом Tandoor (категории ВХ/МК, серия, артикул, витрина).
 * Репозиторий tandoor-bitrix в среде недоступен для прямого копирования шаблонов.
 */

export type CatalogProduct = {
  id: string;
  name: string;
  article: string;
  category: string;
  series: string;
  type: string;
  status: string;
  image: string | null;
  shortDescription: string;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  equipment: string[];
  colors: string[];
  sizes: string[];
  isTop: boolean;
  isNew: boolean;
  showcasePriority: number;
  salesPriority: number;
  recommendedForShowcase: boolean;
  relatedDealerIds: string[];
  relatedTradePointIds: string[];
  relatedTaskCount: number;
};

const rows: CatalogProduct[] = [
  {
    id: "vh-gr-100",
    name: "Входная группа «Гранд» 100",
    article: "VH-GR-100",
    category: "Входные группы",
    series: "Гранд",
    type: "Модель",
    status: "В продаже",
    image: null,
    shortDescription: "Стальная входная группа с усиленной коробкой и фурнитурой под МК.",
    description:
      "Серия «Гранд» ориентирована на объектный и розничный сегмент. Коробка и полотно согласованы по толщине с линейкой мебельной фурнитуры Tandoor для единого визуала на витрине.",
    features: ["Усиленная коробка", "Совместимость с МК по толщине", "Три варианта отделки полотна"],
    specs: [
      { label: "Ширина проёма, мм", value: "860 / 960" },
      { label: "Толщина полотна, мм", value: "55" },
      { label: "Класс взломостойкости", value: "по проекту партнёра" },
      { label: "Петли", value: "3 шт., регулируемые" },
    ],
    equipment: ["Коробка", "Полотно", "Петли", "Замковый комплект (без цилиндра)", "Ручка на выбор"],
    colors: ["Антрацит", "Каштан", "Слоновая кость"],
    sizes: ["860×2050", "960×2050"],
    isTop: true,
    isNew: false,
    showcasePriority: 9,
    salesPriority: 10,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "002", "007", "012", "015"],
    relatedTradePointIds: ["001-01", "007-01", "012-01"],
    relatedTaskCount: 2,
  },
  {
    id: "vh-gr-90",
    name: "Входная группа «Гранд» 90",
    article: "VH-GR-90",
    category: "Входные группы",
    series: "Гранд",
    type: "Модель",
    status: "В продаже",
    image: null,
    shortDescription: "Компактная ширина 900 мм для узких коридоров.",
    description: "Та же фурнитура и коробка, что у модели 100, суженный проём для типовых планировок.",
    features: ["Узкий проём", "Совместимость с МК"],
    specs: [
      { label: "Ширина проёма, мм", value: "900" },
      { label: "Толщина полотна, мм", value: "55" },
    ],
    equipment: ["Коробка", "Полотно", "Петли", "Ручка на выбор"],
    colors: ["Антрацит", "Каштан"],
    sizes: ["900×2050"],
    isTop: true,
    isNew: false,
    showcasePriority: 8,
    salesPriority: 9,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "003", "007"],
    relatedTradePointIds: ["001-01", "001-02"],
    relatedTaskCount: 0,
  },
  {
    id: "mk-set-pro",
    name: "Набор мебельной фурнитуры «Про»",
    article: "MK-SET-PRO",
    category: "Мебельная фурнитура",
    series: "Про",
    type: "Комплект",
    status: "В продаже",
    image: null,
    shortDescription: "Петли, направляющие и ручки для полноформатной витрины МК.",
    description: "Базовый набор для монтажа образцов на стенде. Подходит для обучения продавцов и стандартной выкладки.",
    features: ["Полный комплект для стенда", "Упаковка для транспортировки"],
    specs: [
      { label: "Петли, шт.", value: "8" },
      { label: "Направляющие, комплект", value: "2" },
    ],
    equipment: ["Петли скрытые", "Телескопические направляющие", "Ручки-скобы"],
    colors: ["Никель матовый", "Чёрный"],
    sizes: ["универсальный"],
    isTop: true,
    isNew: true,
    showcasePriority: 10,
    salesPriority: 10,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "002", "004", "007", "010", "018"],
    relatedTradePointIds: ["001-01", "007-01", "010-01", "018-01"],
    relatedTaskCount: 3,
  },
  {
    id: "mk-hinge-soft",
    name: "Петля мебельная скрытая с доводчиком",
    article: "MK-H-SOFT",
    category: "Мебельная фурнитура",
    series: "Soft",
    type: "Позиция",
    status: "В продаже",
    image: null,
    shortDescription: "Скрытая петля с плавным закрыванием для фасадов средней массы.",
    description: "Используется в салонах как отдельная позиция и в составе витринных комплектов.",
    features: ["3D-регулировка", "Угол открывания 110°"],
    specs: [
      { label: "Нагрузка на пару, кг", value: "до 60" },
      { label: "Материал", value: "сталь, покрытие" },
    ],
    equipment: ["Петля левая/правая — по спецификации"],
    colors: ["Никель", "Чёрный"],
    sizes: ["универсальная"],
    isTop: false,
    isNew: true,
    showcasePriority: 7,
    salesPriority: 8,
    recommendedForShowcase: true,
    relatedDealerIds: ["005", "007", "014"],
    relatedTradePointIds: ["007-01", "014-01"],
    relatedTaskCount: 1,
  },
  {
    id: "vh-thermo-96",
    name: "Входная группа с терморазрывом 960",
    article: "VH-TH-96",
    category: "Входные группы",
    series: "Термо",
    type: "Модель",
    status: "К заказу",
    image: null,
    shortDescription: "Для объектов с повышенными требованиями по теплу и шуму.",
    description: "Увеличенный терморазрыв и комплект уплотнителей. Сроки уточняются при заказе.",
    features: ["Терморазрыв", "Двойной контур уплотнения"],
    specs: [
      { label: "Ширина, мм", value: "960" },
      { label: "Коэффициент сопротивления теплопередаче", value: "по паспорту серии" },
    ],
    equipment: ["Коробка с термовставкой", "Полотно", "Комплект уплотнителей", "Порог"],
    colors: ["Серый графит", "Дуб натуральный"],
    sizes: ["960×2100"],
    isTop: false,
    isNew: true,
    showcasePriority: 6,
    salesPriority: 7,
    recommendedForShowcase: false,
    relatedDealerIds: ["007", "011", "020"],
    relatedTradePointIds: ["007-01", "011-01"],
    relatedTaskCount: 2,
  },
  {
    id: "mk-slide-tandem",
    name: "Система раздвижения Tandem для шкафа",
    article: "MK-SL-TD",
    category: "Мебельная фурнитура",
    series: "Slide",
    type: "Модель",
    status: "В продаже",
    image: null,
    shortDescription: "Плавный ход и мягкое закрывание для шкафов-купе на витрине.",
    description: "Популярная позиция для показа качества направляющих. Рекомендуется к паре с фасадными образцами.",
    features: ["Мягкое закрывание", "Нагрузка до 40 кг на дверь"],
    specs: [
      { label: "Длина направляющей, мм", value: "2700 / 3000" },
      { label: "Число дверей", value: "2" },
    ],
    equipment: ["Направляющие", "Ролики", "Демпферы", "Крепёж"],
    colors: ["Оцинкованная сталь"],
    sizes: ["2700", "3000"],
    isTop: true,
    isNew: false,
    showcasePriority: 8,
    salesPriority: 9,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "008", "012"],
    relatedTradePointIds: ["001-02", "012-01"],
    relatedTaskCount: 0,
  },
  {
    id: "vh-office-line",
    name: "Входная группа «Офис»",
    article: "VH-OFC-01",
    category: "Входные группы",
    series: "Офис",
    type: "Модель",
    status: "Ограниченный запас",
    image: null,
    shortDescription: "Нестандартная высота под офисные проёмы.",
    description: "Серия для B2B-поставок в офисные центры. Проверять наличие перед витриной.",
    features: ["Высота до 2300 мм", "Усиленные петли"],
    specs: [
      { label: "Высота, мм", value: "до 2300" },
      { label: "Ширина, мм", value: "900 / 1000" },
    ],
    equipment: ["Коробка", "Полотно", "Петли 4 шт.", "Замок врезной"],
    colors: ["Серый", "Белый"],
    sizes: ["900×2200", "1000×2200"],
    isTop: false,
    isNew: false,
    showcasePriority: 4,
    salesPriority: 6,
    recommendedForShowcase: false,
    relatedDealerIds: ["004", "009"],
    relatedTradePointIds: ["004-01"],
    relatedTaskCount: 4,
  },
  {
    id: "mk-handle-line",
    name: "Ручка мебельная «Линия»",
    article: "MK-HN-LN",
    category: "Мебельная фурнитура",
    series: "Линия",
    type: "Позиция",
    status: "В продаже",
    image: null,
    shortDescription: "Профильная ручка для кухонных фасадов и шкафов.",
    description: "Массовая позиция для допродаж и комплектации витринных стендов.",
    features: ["Защитное покрытие", "Крепление с тыльной стороны"],
    specs: [
      { label: "Длина, мм", value: "128 / 160 / 192" },
      { label: "Межосевое, мм", value: "96 / 128 / 160" },
    ],
    equipment: ["Ручка", "Винты в комплекте"],
    colors: ["Матовый никель", "Чёрный", "Золото матовое"],
    sizes: ["128", "160", "192"],
    isTop: false,
    isNew: false,
    showcasePriority: 5,
    salesPriority: 7,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "002", "003", "005", "006"],
    relatedTradePointIds: ["001-01", "003-01", "006-01"],
    relatedTaskCount: 0,
  },
  {
    id: "vh-fire-line",
    name: "Входная группа повышенной стойкости",
    article: "VH-FR-01",
    category: "Входные группы",
    series: "Проект",
    type: "Модель",
    status: "Требует внимания по наличию",
    image: null,
    shortDescription: "Позиция с нестабильным складским остатком — согласовывать снабжение.",
    description: "Использовать в каталоге с пометкой о сроках. Для витрины — только после подтверждения отдела логистики.",
    features: ["Усиленное полотно", "Дополнительные ребра жёсткости"],
    specs: [
      { label: "Вес полотна, кг", value: "от 42" },
      { label: "Ширина, мм", value: "860" },
    ],
    equipment: ["Коробка усиленная", "Полотно", "Петли 4 шт.", "Уплотнители"],
    colors: ["Антрацит"],
    sizes: ["860×2050"],
    isTop: false,
    isNew: false,
    showcasePriority: 3,
    salesPriority: 5,
    recommendedForShowcase: false,
    relatedDealerIds: ["007", "013", "022"],
    relatedTradePointIds: ["007-02", "013-01"],
    relatedTaskCount: 5,
  },
  {
    id: "mk-lift-up",
    name: "Подъёмный механизм для фасада",
    article: "MK-LF-UP",
    category: "Мебельная фурнитура",
    series: "Lift",
    type: "Позиция",
    status: "В продаже",
    image: null,
    shortDescription: "Для верхних фасадов кухонных модулей на витрине.",
    description: "Компактный газлифт с фиксацией в открытом положении.",
    features: ["Плавное открывание", "Регулировка усилия"],
    specs: [
      { label: "Нагрузка, Н", value: "80 / 100 / 120" },
    ],
    equipment: ["Газлифт", "Крепления к корпусу и фасаду"],
    colors: ["Серый"],
    sizes: ["80Н", "100Н", "120Н"],
    isTop: false,
    isNew: true,
    showcasePriority: 6,
    salesPriority: 7,
    recommendedForShowcase: true,
    relatedDealerIds: ["010", "016", "018"],
    relatedTradePointIds: ["010-01", "018-01"],
    relatedTaskCount: 1,
  },
  {
    id: "vh-compact-80",
    name: "Входная группа «Компакт» 800",
    article: "VH-CP-80",
    category: "Входные группы",
    series: "Компакт",
    type: "Модель",
    status: "В продаже",
    image: null,
    shortDescription: "Минимальная ширина для технических помещений и второго входа.",
    description: "Лёгкое полотно, базовая фурнитура. Для витрины — как дополнение к основной ВХ.",
    features: ["Узкий проём", "Базовая комплектация"],
    specs: [{ label: "Ширина, мм", value: "800" }],
    equipment: ["Коробка", "Полотно", "Петли", "Заглушки"],
    colors: ["Белый"],
    sizes: ["800×2000"],
    isTop: false,
    isNew: false,
    showcasePriority: 5,
    salesPriority: 6,
    recommendedForShowcase: false,
    relatedDealerIds: ["006", "014"],
    relatedTradePointIds: ["014-01"],
    relatedTaskCount: 0,
  },
  {
    id: "mk-cornice-kit",
    name: "Комплект карнизных элементов",
    article: "MK-CR-KIT",
    category: "Мебельная фурнитура",
    series: "Аксессуары",
    type: "Комплект",
    status: "В продаже",
    image: null,
    shortDescription: "Для оформления верхней зоны кухонного модуля на стенде.",
    description: "Декоративные накладки и крепёж для полного образа кухни на стенде.",
    features: ["Быстрый монтаж", "Совместимость с фасадами 16 мм"],
    specs: [{ label: "Длина комплекта, мм", value: "3000" }],
    equipment: ["Профиль", "Заглушки", "Крепёж"],
    colors: ["Алюминий", "Чёрный"],
    sizes: ["3000"],
    isTop: false,
    isNew: true,
    showcasePriority: 5,
    salesPriority: 6,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "019"],
    relatedTradePointIds: ["001-01"],
    relatedTaskCount: 0,
  },
];

export const CATALOG_PRODUCTS: CatalogProduct[] = rows;

export function getProductById(id: string): CatalogProduct | undefined {
  const t = id.trim().toLowerCase();
  return CATALOG_PRODUCTS.find((p) => p.id.toLowerCase() === t);
}

export function normalizeDealerIdForCatalog(raw: string): string {
  const n = parseInt(raw.trim(), 10);
  if (Number.isFinite(n) && n >= 1 && n <= 999) {
    return String(n).padStart(3, "0");
  }
  return raw.trim();
}

export function getProductsForDealer(dealerId: string): CatalogProduct[] {
  const id = normalizeDealerIdForCatalog(dealerId);
  return CATALOG_PRODUCTS.filter((p) => p.relatedDealerIds.includes(id));
}

export function getProductsForTradePoint(dealerId: string, pointId: string): CatalogProduct[] {
  const d = normalizeDealerIdForCatalog(dealerId);
  const normalizedPoint = pointId.includes("-") ? pointId.trim() : `${d}-${pointId.trim().padStart(2, "0")}`;
  return CATALOG_PRODUCTS.filter((p) => p.relatedTradePointIds.includes(normalizedPoint));
}

/** Для блока «модели в работе» у дилера — стабильный поднабор по id дилера. */
export function getDealerProductPreview(dealerId: string, max = 5): CatalogProduct[] {
  const list = getProductsForDealer(dealerId);
  if (list.length <= max) return list;
  const n = parseInt(dealerId, 10) || 0;
  const start = n % Math.max(1, list.length - max + 1);
  return list.slice(start, start + max);
}

/** Для блока «модели на витрине» у ТТ. */
export function getTradePointProductPreview(dealerId: string, pointId: string, max = 5): CatalogProduct[] {
  const list = getProductsForTradePoint(dealerId, pointId);
  if (list.length <= max) return list;
  return list.slice(0, max);
}

export type DealerProductRowStatus = "продаётся" | "добавить в витрину" | "проверить наличие";

export function dealerRowStatusForProduct(product: CatalogProduct): DealerProductRowStatus {
  if (product.status.includes("Требует") || product.status.includes("Ограничен")) return "проверить наличие";
  if (!product.recommendedForShowcase) return "добавить в витрину";
  return "продаётся";
}

export type TradePointShowcaseRowStatus = "на витрине" | "запланировать" | "проверить выкладку";

export function tradePointShowcaseStatusForProduct(product: CatalogProduct): TradePointShowcaseRowStatus {
  if (product.recommendedForShowcase) return "на витрине";
  if (product.relatedTaskCount >= 2) return "проверить выкладку";
  return "запланировать";
}
