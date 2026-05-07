/**
 * Локальный каталог моделей Тандор для платформы.
 * Структура полей и набор фильтров согласованы с реальным сайтом/ЛК Tandoor:
 * категории (входные/межкомнатные/скрытые), серия, артикул, размер полотна,
 * толщина, покрытие, тип открывания, производитель, гарантия, отметки
 * хитов/новинок/эксклюзива/акции/наличия, рекомендация для витрины.
 *
 * Первый слой позиций берётся из публичного каталога tandoor.ru (см. `tandoor-real-catalog-seed.generated.ts`
 * и скрипт `scripts/import-tandoor-public-catalog.mjs`); ниже остаётся прежний мок для демо-связей
 * с дилерами и задачами. Публичные позиции не участвуют в моке матрицы витрин (`includeInTradePointMatrix: false`).
 */

import {
  TANDOOR_REAL_CATALOG_SEED,
  type TandoorRealCatalogSeedItem,
} from "./tandoor-real-catalog-seed.generated";

export type CatalogProduct = {
  id: string;
  name: string;
  article: string;
  category: string;
  series: string;
  type: string;
  doorKind: string;
  status: string;
  image: string | null;
  shortDescription: string;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  equipment: string[];
  variants: { label: string; value: string }[];
  colors: string[];
  sizes: string[];
  manufacturer: string;
  warranty: string;
  coating: string;
  openType: string;
  isTop: boolean;
  isNew: boolean;
  isExclusive: boolean;
  isAction: boolean;
  inStock: boolean;
  showcasePriority: number;
  salesPriority: number;
  recommendedForShowcase: boolean;
  relatedDealerIds: string[];
  relatedTradePointIds: string[];
  relatedTaskCount: number;
  history: { date: string; event: string }[];
  /** Ссылка на публичную карточку на сайте Tandoor (для справки менеджера). */
  sourcePublicUrl?: string;
  /** Розничная цена с публичной витрины, если передана в seed. */
  priceRetailRub?: number;
  /** Дополнительные токены для поиска в каталоге платформы. */
  catalogTags?: string[];
  /** Нормализованная строка поиска (категория, теги, коллекция). */
  catalogSearchText?: string;
  /** Если false — позиция не попадает в мок матрицы витрин ТТ (по умолчанию true). */
  includeInTradePointMatrix?: boolean;
  /** Галерея с публичного импорта (главное фото дублируется в `image`). */
  catalogImages?: { src: string; alt: string }[];
};

function cleanPublicDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&#8381;/g, "₽")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function mapPublicSeedToCatalogProduct(row: TandoorRealCatalogSeedItem): CatalogProduct {
  const doorKind =
    row.category === "entrance" ? "Входная" : row.category === "interior" ? "Межкомнатная" : "Фурнитура";
  const categoryLabel =
    row.category === "entrance"
      ? "Входные двери"
      : row.category === "interior"
        ? "Межкомнатные двери"
        : "Фурнитура";
  const series = row.collection ?? "Каталог Tandoor";
  const coatingGuess = () => {
    const t = row.title.toLowerCase();
    if (t.includes("эмаль") || t.includes("emal")) return "Эмаль";
    if (t.includes("шпон")) return "Шпон";
    if (t.includes("ламинат")) return "Ламинат";
    if (t.includes("пэт") || t.includes("pet")) return "ПЭТ";
    if (t.includes("мдф") || t.includes("mdf")) return "МДФ";
    if (row.category === "hardware") return "Фурнитура";
    return "По каталогу";
  };
  const shortDescription = cleanPublicDescription(row.shortDescription) ?? row.title;
  const boostTags: string[] = [];
  if (row.id === "tc-mk-benatti-2-belyy-zhemchug-dg-2000-800") boostTags.push("Zefir", "зефир");
  if (row.id === "tc-mk-benatti-1-0-belyy-zhemchug-dg-2100-800" || row.id === "tc-mk-benatti-1-0-belyy-zhemchug-dg-2000-800") {
    boostTags.push("Grand 13", "Гранд 13", "Medzhik", "меджик");
  }
  if (row.id === "tc-mk-m-36-emal-belaya-dg-2000-800") boostTags.push("Mona", "мона");
  const mergedTags = [...row.tags, ...boostTags];
  const catalogImages = (row.images ?? [{ src: row.imageSrc, alt: row.imageAlt }]).map((im) => ({
    src: im.src,
    alt: im.alt,
  }));
  const searchText = [row.searchText, ...boostTags, ...catalogImages.map((c) => c.alt)].join(" ").toLowerCase();
  const specs: { label: string; value: string }[] = [];
  if (typeof row.priceRetail === "number") {
    specs.push({ label: "Розничная цена, ₽", value: String(row.priceRetail) });
  }
  specs.push({ label: "Категория", value: categoryLabel });
  if (row.collection) specs.push({ label: "Коллекция / модель", value: row.collection });

  return {
    id: row.id,
    name: row.title,
    article: row.id.replace(/^tc-(?:vh|mk|hw)-/, "").slice(0, 28).toUpperCase(),
    category: categoryLabel,
    series,
    type: row.category === "hardware" ? "Артикул" : "Модель",
    doorKind,
    status: "В продаже",
    image: catalogImages[0]?.src ?? row.imageSrc,
    shortDescription,
    description: shortDescription,
    features: mergedTags,
    specs,
    equipment: row.category === "hardware" ? ["Комплект по спецификации витрины"] : ["Полотно", "Коробка", "Фурнитура по комплекту"],
    variants: [{ label: "Исполнение", value: "См. публичную карточку" }],
    colors: [],
    sizes: [],
    manufacturer: "Tandoor",
    warranty: "По условиям производителя",
    coating: coatingGuess(),
    openType: row.category === "hardware" ? "—" : "См. карточку",
    isTop: false,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 3,
    salesPriority: 5,
    recommendedForShowcase: false,
    relatedDealerIds: [],
    relatedTradePointIds: [],
    relatedTaskCount: 0,
    history: [],
    sourcePublicUrl: row.sourceUrl,
    priceRetailRub: row.priceRetail,
    catalogTags: mergedTags,
    catalogSearchText: searchText,
    includeInTradePointMatrix: false,
    catalogImages: catalogImages.length > 1 ? catalogImages : undefined,
  };
}

const mockCatalogRows: CatalogProduct[] = [
  {
    id: "vh-grand-3",
    name: "Гранд 3",
    article: "VH-GRAND-3",
    category: "Входные двери",
    series: "Гранд",
    type: "Модель",
    doorKind: "Входная",
    status: "В продаже",
    image: null,
    shortDescription: "Флагманская входная серия с тёплым контуром и усиленным полотном.",
    description:
      "Серия «Гранд» — представительская линейка входных дверей Tandoor. Многослойное полотно с терморазрывом, четыре контура уплотнения, ригельный замковый комплект. Подходит для квартир и загородных домов с повышенными требованиями к тепло- и шумоизоляции.",
    features: [
      "Терморазрыв и четыре контура уплотнения",
      "Усиленное стальное полотно",
      "Регулируемые петли с противосъёмными штырями",
      "Совместимость с межкомнатными сериями Tandoor по тону",
    ],
    specs: [
      { label: "Толщина полотна, мм", value: "100" },
      { label: "Размер полотна, мм", value: "2050 × 860 / 960" },
      { label: "Покрытие", value: "МДФ-панель + Soft-touch" },
      { label: "Замки", value: "Сувальдный + цилиндровый" },
      { label: "Глазок", value: "Широкоугольный" },
      { label: "Утеплитель", value: "Минеральный" },
    ],
    equipment: [
      "Стальная коробка",
      "Полотно",
      "Петли усиленные, 3 шт.",
      "Замковый комплект (без цилиндра)",
      "Глазок широкоугольный",
      "Ручка на выбор",
    ],
    variants: [
      { label: "Открывание", value: "На себя / От себя" },
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Внешняя отделка", value: "Антрацит / Венге / Дуб" },
    ],
    colors: ["Антрацит", "Венге", "Дуб натуральный"],
    sizes: ["860 × 2050", "960 × 2050"],
    manufacturer: "Tandoor",
    warranty: "5 лет",
    coating: "МДФ-панель + Soft-touch",
    openType: "На себя / От себя",
    isTop: true,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 10,
    salesPriority: 10,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "002", "007", "012", "015"],
    relatedTradePointIds: ["001-01", "007-01", "012-01"],
    relatedTaskCount: 2,
    history: [
      { date: "12.04.2026", event: "Обновлены фотоматериалы для каталога дилеров" },
      { date: "03.03.2026", event: "Добавлено исполнение в цвете «Дуб натуральный»" },
      { date: "20.01.2026", event: "Согласована витринная выкладка для регионов" },
    ],
  },
  {
    id: "vh-grand-4",
    name: "Гранд 4",
    article: "VH-GRAND-4",
    category: "Входные двери",
    series: "Гранд",
    type: "Модель",
    doorKind: "Входная",
    status: "В продаже",
    image: null,
    shortDescription: "Облегчённая комплектация серии «Гранд» с базовой фурнитурой.",
    description:
      "Та же геометрия и термоконтур, что у флагмана, но в более лаконичном исполнении: один сувальдный замок и базовый набор петель. Подходит для типовых квартир.",
    features: [
      "Базовая фурнитура серии «Гранд»",
      "Терморазрыв",
      "Совместимость с МК-сериями по фактуре",
    ],
    specs: [
      { label: "Толщина полотна, мм", value: "90" },
      { label: "Размер полотна, мм", value: "2050 × 860 / 960" },
      { label: "Покрытие", value: "МДФ-панель" },
      { label: "Замки", value: "Сувальдный" },
      { label: "Глазок", value: "Стандартный" },
    ],
    equipment: ["Коробка", "Полотно", "Петли 3 шт.", "Замковый комплект", "Глазок", "Ручка на выбор"],
    variants: [
      { label: "Открывание", value: "На себя / От себя" },
      { label: "Сторона петель", value: "Левая / Правая" },
    ],
    colors: ["Антрацит", "Венге"],
    sizes: ["860 × 2050", "960 × 2050"],
    manufacturer: "Tandoor",
    warranty: "3 года",
    coating: "МДФ-панель",
    openType: "На себя / От себя",
    isTop: true,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 8,
    salesPriority: 9,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "003", "007"],
    relatedTradePointIds: ["001-01", "001-02"],
    relatedTaskCount: 0,
    history: [
      { date: "10.04.2026", event: "Обновлены технические характеристики" },
      { date: "18.02.2026", event: "Добавлена в основной выставочный набор" },
    ],
  },
  {
    id: "vh-grand-5",
    name: "Гранд 5",
    article: "VH-GRAND-5",
    category: "Входные двери",
    series: "Гранд",
    type: "Модель",
    doorKind: "Входная",
    status: "В продаже",
    image: null,
    shortDescription: "Расширенная комплектация серии «Гранд» с дополнительным контуром.",
    description:
      "Версия с пятью контурами уплотнения и усиленным замковым узлом. Рекомендуется для домов и коттеджей.",
    features: ["Пять контуров уплотнения", "Усиленный замковый узел", "Бронепластина"],
    specs: [
      { label: "Толщина полотна, мм", value: "100" },
      { label: "Размер полотна, мм", value: "2050 × 960" },
      { label: "Покрытие", value: "МДФ + Soft-touch" },
      { label: "Замки", value: "Сувальдный + цилиндровый, броненакладка" },
    ],
    equipment: ["Коробка", "Полотно", "Петли 3 шт.", "Замковый комплект", "Бронепластина", "Глазок"],
    variants: [
      { label: "Открывание", value: "На себя / От себя" },
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Внешняя отделка", value: "Антрацит / Венге / Дуб / Графит" },
    ],
    colors: ["Антрацит", "Венге", "Дуб натуральный", "Графит"],
    sizes: ["960 × 2050"],
    manufacturer: "Tandoor",
    warranty: "5 лет",
    coating: "МДФ + Soft-touch",
    openType: "На себя / От себя",
    isTop: true,
    isNew: true,
    isExclusive: true,
    isAction: false,
    inStock: true,
    showcasePriority: 10,
    salesPriority: 10,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "002", "004", "007", "010", "018"],
    relatedTradePointIds: ["001-01", "007-01", "010-01", "018-01"],
    relatedTaskCount: 3,
    history: [
      { date: "28.04.2026", event: "Поставлена в эксклюзивную программу для розничных партнёров" },
      { date: "15.03.2026", event: "Получены сертификаты по новой комплектации" },
      { date: "21.02.2026", event: "Запуск серии в основную линейку" },
    ],
  },
  {
    id: "vh-kvarc",
    name: "Кварц",
    article: "VH-KVARC",
    category: "Входные двери",
    series: "Кварц",
    type: "Модель",
    doorKind: "Входная",
    status: "В продаже",
    image: null,
    shortDescription: "Стальная входная дверь среднего сегмента с лаконичной геометрией.",
    description:
      "Серия «Кварц» — практичный выбор для квартир. Стальное полотно, два контура уплотнения, базовый замковый комплект.",
    features: ["Стальное полотно", "Два контура уплотнения", "Регулируемые петли"],
    specs: [
      { label: "Толщина полотна, мм", value: "70" },
      { label: "Размер полотна, мм", value: "2050 × 860" },
      { label: "Покрытие", value: "МДФ-панель" },
      { label: "Замки", value: "Сувальдный" },
    ],
    equipment: ["Коробка", "Полотно", "Петли 2 шт.", "Замковый комплект", "Глазок"],
    variants: [
      { label: "Открывание", value: "На себя / От себя" },
      { label: "Сторона петель", value: "Левая / Правая" },
    ],
    colors: ["Антрацит", "Белый"],
    sizes: ["860 × 2050"],
    manufacturer: "Tandoor",
    warranty: "2 года",
    coating: "МДФ-панель",
    openType: "На себя / От себя",
    isTop: false,
    isNew: false,
    isExclusive: false,
    isAction: true,
    inStock: true,
    showcasePriority: 6,
    salesPriority: 8,
    recommendedForShowcase: true,
    relatedDealerIds: ["005", "007", "014"],
    relatedTradePointIds: ["007-01", "014-01"],
    relatedTaskCount: 1,
    history: [
      { date: "01.04.2026", event: "Включена в текущую акцию для дилеров" },
      { date: "10.01.2026", event: "Корректировка комплектации (петли)" },
    ],
  },
  {
    id: "vh-siriys",
    name: "Сириус",
    article: "VH-SIRIYS",
    category: "Входные двери",
    series: "Сириус",
    type: "Модель",
    doorKind: "Входная",
    status: "К заказу",
    image: null,
    shortDescription: "Серия с акцентом на дизайн фасада и индивидуальные исполнения.",
    description:
      "«Сириус» собирается под заказ с индивидуальным фасадом. Для розничной витрины используется как образец возможностей серии.",
    features: ["Дизайнерский фасад", "Под заказ", "Совмещается с МДФ-панелями"],
    specs: [
      { label: "Толщина полотна, мм", value: "90" },
      { label: "Размер полотна, мм", value: "по проекту" },
      { label: "Покрытие", value: "Эмаль / МДФ" },
    ],
    equipment: ["Коробка", "Полотно", "Петли 3 шт.", "Замковый комплект", "Глазок"],
    variants: [
      { label: "Открывание", value: "На себя / От себя" },
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Фасад", value: "По проекту партнёра" },
    ],
    colors: ["Антрацит", "Графит", "По проекту"],
    sizes: ["По проекту"],
    manufacturer: "Tandoor",
    warranty: "3 года",
    coating: "Эмаль / МДФ",
    openType: "На себя / От себя",
    isTop: false,
    isNew: true,
    isExclusive: true,
    isAction: false,
    inStock: false,
    showcasePriority: 7,
    salesPriority: 7,
    recommendedForShowcase: false,
    relatedDealerIds: ["007", "011", "020"],
    relatedTradePointIds: ["007-01", "011-01"],
    relatedTaskCount: 2,
    history: [
      { date: "20.04.2026", event: "Подготовка эксклюзивных макетов для региональной выставки" },
      { date: "05.03.2026", event: "Расширение опций индивидуального фасада" },
    ],
  },
  {
    id: "vh-neapol",
    name: "Неаполь",
    article: "VH-NEAPOL",
    category: "Входные двери",
    series: "Неаполь",
    type: "Модель",
    doorKind: "Входная",
    status: "В продаже",
    image: null,
    shortDescription: "Классика серии входных дверей с фактурными МДФ-панелями.",
    description:
      "Серия «Неаполь» сочетает классические молдинги и современную фурнитуру. Один из устойчивых лидеров продаж.",
    features: ["Фактурные МДФ-панели", "Усиленный замковый узел", "Стабильный спрос"],
    specs: [
      { label: "Толщина полотна, мм", value: "90" },
      { label: "Размер полотна, мм", value: "2050 × 860 / 960" },
      { label: "Покрытие", value: "МДФ-панель" },
      { label: "Замки", value: "Сувальдный + цилиндровый" },
    ],
    equipment: ["Коробка", "Полотно", "Петли 3 шт.", "Замковый комплект", "Глазок"],
    variants: [
      { label: "Открывание", value: "На себя / От себя" },
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Внешняя отделка", value: "Венге / Дуб / Орех" },
    ],
    colors: ["Венге", "Дуб натуральный", "Орех"],
    sizes: ["860 × 2050", "960 × 2050"],
    manufacturer: "Tandoor",
    warranty: "3 года",
    coating: "МДФ-панель",
    openType: "На себя / От себя",
    isTop: true,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 9,
    salesPriority: 10,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "002", "003", "005", "006"],
    relatedTradePointIds: ["001-01", "003-01", "006-01"],
    relatedTaskCount: 0,
    history: [
      { date: "08.04.2026", event: "Обновлена продуктовая презентация для розничных дилеров" },
      { date: "16.02.2026", event: "Добавлено исполнение в цвете «Орех»" },
    ],
  },
  {
    id: "vh-kapelli",
    name: "Капелли",
    article: "VH-KAPELLI",
    category: "Входные двери",
    series: "Капелли",
    type: "Модель",
    doorKind: "Входная",
    status: "Ограниченный запас",
    image: null,
    shortDescription: "Серия с нестандартной геометрией фасада, ограниченные партии.",
    description:
      "«Капелли» — позиция с ограниченным наличием. Перед выкладкой на витрину уточняйте остаток у регионального менеджера.",
    features: ["Нестандартный фасад", "Ограниченные партии"],
    specs: [
      { label: "Толщина полотна, мм", value: "90" },
      { label: "Размер полотна, мм", value: "2050 × 860" },
      { label: "Покрытие", value: "МДФ-панель" },
    ],
    equipment: ["Коробка", "Полотно", "Петли 3 шт.", "Замковый комплект"],
    variants: [
      { label: "Открывание", value: "На себя / От себя" },
      { label: "Сторона петель", value: "Левая / Правая" },
    ],
    colors: ["Антрацит"],
    sizes: ["860 × 2050"],
    manufacturer: "Tandoor",
    warranty: "3 года",
    coating: "МДФ-панель",
    openType: "На себя / От себя",
    isTop: false,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: false,
    showcasePriority: 4,
    salesPriority: 5,
    recommendedForShowcase: false,
    relatedDealerIds: ["007", "013", "022"],
    relatedTradePointIds: ["007-02", "013-01"],
    relatedTaskCount: 5,
    history: [
      { date: "30.04.2026", event: "Согласование графика поставок ограниченной партии" },
      { date: "12.03.2026", event: "Уточнение комплектации с производством" },
    ],
  },
  {
    id: "mk-grand-3-mk",
    name: "Гранд 3 МК",
    article: "MK-GRAND-3",
    category: "Межкомнатные двери",
    series: "Гранд",
    type: "Модель",
    doorKind: "Межкомнатная",
    status: "В продаже",
    image: null,
    shortDescription: "Межкомнатная серия в едином стиле с входной серией «Гранд».",
    description:
      "МК-серия «Гранд 3» сделана в одинаковой фактуре с входной серией. Используется в составе комплектов «вход + межкомнатные» для единого стиля квартиры.",
    features: ["Совместимость с входной серией «Гранд»", "Скрытые петли", "Единая фактура полотна"],
    specs: [
      { label: "Толщина полотна, мм", value: "40" },
      { label: "Размер полотна, мм", value: "2000 × 600 / 700 / 800 / 900" },
      { label: "Покрытие", value: "МДФ-панель" },
      { label: "Тип короба", value: "Стандартный" },
    ],
    equipment: ["Полотно", "Коробка", "Наличники", "Петли скрытые", "Замок-защёлка"],
    variants: [
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Цвет покрытия", value: "Венге / Дуб / Антрацит" },
      { label: "Стекло", value: "Без стекла / Матовое" },
    ],
    colors: ["Венге", "Дуб натуральный", "Антрацит"],
    sizes: ["600 × 2000", "700 × 2000", "800 × 2000", "900 × 2000"],
    manufacturer: "Tandoor",
    warranty: "3 года",
    coating: "МДФ-панель",
    openType: "Распашная",
    isTop: true,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 9,
    salesPriority: 9,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "008", "012"],
    relatedTradePointIds: ["001-02", "012-01"],
    relatedTaskCount: 0,
    history: [
      { date: "03.04.2026", event: "Обновлена линейка размеров полотна" },
    ],
  },
  {
    id: "mk-grand-4",
    name: "Гранд 4 МК",
    article: "MK-GRAND-4",
    category: "Межкомнатные двери",
    series: "Гранд",
    type: "Модель",
    doorKind: "Межкомнатная",
    status: "В продаже",
    image: null,
    shortDescription: "Облегчённая межкомнатная модель серии «Гранд» с базовой фурнитурой.",
    description:
      "Базовая комплектация межкомнатной серии «Гранд». Подходит для типовых проёмов и быстрых заказов.",
    features: ["Базовый комплект", "Совместимость с входной серией"],
    specs: [
      { label: "Толщина полотна, мм", value: "40" },
      { label: "Размер полотна, мм", value: "2000 × 600 / 700 / 800" },
      { label: "Покрытие", value: "МДФ-панель" },
    ],
    equipment: ["Полотно", "Коробка", "Наличники", "Петли", "Замок-защёлка"],
    variants: [
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Цвет покрытия", value: "Венге / Дуб / Серый" },
    ],
    colors: ["Венге", "Дуб натуральный", "Серый"],
    sizes: ["600 × 2000", "700 × 2000", "800 × 2000"],
    manufacturer: "Tandoor",
    warranty: "2 года",
    coating: "МДФ-панель",
    openType: "Распашная",
    isTop: false,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 6,
    salesPriority: 7,
    recommendedForShowcase: false,
    relatedDealerIds: ["004", "009"],
    relatedTradePointIds: ["004-01"],
    relatedTaskCount: 4,
    history: [
      { date: "21.04.2026", event: "Обновлены наличники и крепёжный комплект" },
    ],
  },
  {
    id: "mk-grand-5",
    name: "Гранд 5 МК",
    article: "MK-GRAND-5",
    category: "Межкомнатные двери",
    series: "Гранд",
    type: "Модель",
    doorKind: "Межкомнатная",
    status: "В продаже",
    image: null,
    shortDescription: "Расширенная межкомнатная серия «Гранд» со скрытыми петлями.",
    description:
      "Версия с улучшенной фурнитурой и скрытыми петлями. Рекомендуется к выкладке в основной зоне витрины.",
    features: ["Скрытые петли", "Магнитный замок-защёлка", "Совместимость с входной серией"],
    specs: [
      { label: "Толщина полотна, мм", value: "44" },
      { label: "Размер полотна, мм", value: "2000 × 700 / 800 / 900" },
      { label: "Покрытие", value: "МДФ + Soft-touch" },
    ],
    equipment: ["Полотно", "Коробка", "Наличники", "Петли скрытые", "Замок магнитный"],
    variants: [
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Цвет покрытия", value: "Венге / Дуб / Антрацит / Графит" },
      { label: "Стекло", value: "Без стекла / Матовое / С рисунком" },
    ],
    colors: ["Венге", "Дуб натуральный", "Антрацит", "Графит"],
    sizes: ["700 × 2000", "800 × 2000", "900 × 2000"],
    manufacturer: "Tandoor",
    warranty: "3 года",
    coating: "МДФ + Soft-touch",
    openType: "Распашная",
    isTop: true,
    isNew: true,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 8,
    salesPriority: 9,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "002", "003", "005", "006"],
    relatedTradePointIds: ["001-01", "003-01", "006-01"],
    relatedTaskCount: 0,
    history: [
      { date: "26.04.2026", event: "Старт выкладки в основной зоне витрины у партнёров" },
      { date: "05.03.2026", event: "Введены два новых исполнения цвета" },
    ],
  },
  {
    id: "mk-kapelli",
    name: "Капелли МК",
    article: "MK-KAPELLI",
    category: "Межкомнатные двери",
    series: "Капелли",
    type: "Модель",
    doorKind: "Межкомнатная",
    status: "В продаже",
    image: null,
    shortDescription: "Тонкая межкомнатная модель с акцентом на дизайн.",
    description:
      "Лёгкое полотно и узкая коробка для современных интерьеров. Хорошо смотрится в комплектации с серией «Капелли» по входной двери.",
    features: ["Узкая коробка", "Лаконичный дизайн", "Совместимость с входной серией «Капелли»"],
    specs: [
      { label: "Толщина полотна, мм", value: "40" },
      { label: "Размер полотна, мм", value: "2000 × 600 / 700 / 800" },
      { label: "Покрытие", value: "Эмаль" },
    ],
    equipment: ["Полотно", "Коробка узкая", "Наличники", "Петли скрытые", "Замок-защёлка"],
    variants: [
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Цвет покрытия", value: "Белый / Антрацит / Графит" },
    ],
    colors: ["Белый", "Антрацит", "Графит"],
    sizes: ["600 × 2000", "700 × 2000", "800 × 2000"],
    manufacturer: "Tandoor",
    warranty: "2 года",
    coating: "Эмаль",
    openType: "Распашная",
    isTop: false,
    isNew: true,
    isExclusive: false,
    isAction: true,
    inStock: true,
    showcasePriority: 7,
    salesPriority: 8,
    recommendedForShowcase: true,
    relatedDealerIds: ["001", "019"],
    relatedTradePointIds: ["001-01"],
    relatedTaskCount: 1,
    history: [
      { date: "15.04.2026", event: "Включена в текущую акцию для дилерской сети" },
    ],
  },
  {
    id: "sk-line",
    name: "Скрытая дверь «Линия»",
    article: "SK-LINE",
    category: "Скрытые двери",
    series: "Линия",
    type: "Модель",
    doorKind: "Скрытая",
    status: "В продаже",
    image: null,
    shortDescription: "Скрытая дверь со скрытой коробкой и плоским полотном под покраску.",
    description:
      "Полотно «в уровень» со стеной и алюминиевая скрытая коробка. Подходит для проектов с акцентом на минимализм.",
    features: ["Скрытая коробка", "Полотно под покраску", "Магнитный замок"],
    specs: [
      { label: "Толщина полотна, мм", value: "40" },
      { label: "Размер полотна, мм", value: "2000 × 700 / 800" },
      { label: "Покрытие", value: "Грунт под покраску" },
    ],
    equipment: ["Полотно", "Коробка алюминиевая скрытая", "Петли скрытые", "Замок магнитный"],
    variants: [
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Открывание", value: "В сторону комнаты / В сторону коридора" },
    ],
    colors: ["Под покраску"],
    sizes: ["700 × 2000", "800 × 2000"],
    manufacturer: "Tandoor",
    warranty: "3 года",
    coating: "Грунт под покраску",
    openType: "Распашная скрытая",
    isTop: false,
    isNew: true,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 6,
    salesPriority: 7,
    recommendedForShowcase: true,
    relatedDealerIds: ["010", "016", "018"],
    relatedTradePointIds: ["010-01", "018-01"],
    relatedTaskCount: 1,
    history: [
      { date: "22.04.2026", event: "Подготовлена техническая карта для проектов под покраску" },
    ],
  },
  {
    id: "ns-project-l",
    name: "Нестандарт «Проект» L",
    article: "NS-PROJECT-L",
    category: "Двери для нестандартных проёмов",
    series: "Проект",
    type: "Модель",
    doorKind: "Входная",
    status: "Под заказ",
    image: null,
    shortDescription: "Модель под индивидуальный проект и нестандартные проёмы.",
    description:
      "Изготовление по проекту партнёра: высота до 2400 мм, ширина — по замеру. Используется в B2B-поставках в офисные центры и нестандартные квартиры.",
    features: ["Высота до 2400 мм", "Ширина по замеру", "Усиленные петли"],
    specs: [
      { label: "Высота, мм", value: "до 2400" },
      { label: "Ширина, мм", value: "по проекту" },
      { label: "Покрытие", value: "По проекту" },
    ],
    equipment: ["Коробка", "Полотно", "Петли 4 шт.", "Замок врезной"],
    variants: [
      { label: "Открывание", value: "На себя / От себя" },
      { label: "Сторона петель", value: "Левая / Правая" },
      { label: "Фасад", value: "По проекту партнёра" },
    ],
    colors: ["По проекту"],
    sizes: ["По проекту"],
    manufacturer: "Tandoor",
    warranty: "3 года",
    coating: "По проекту",
    openType: "На себя / От себя",
    isTop: false,
    isNew: false,
    isExclusive: true,
    isAction: false,
    inStock: false,
    showcasePriority: 3,
    salesPriority: 6,
    recommendedForShowcase: false,
    relatedDealerIds: ["006", "014"],
    relatedTradePointIds: ["014-01"],
    relatedTaskCount: 0,
    history: [
      { date: "11.04.2026", event: "Согласование с производством типовых нестандартных размеров" },
    ],
  },
];

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  ...TANDOOR_REAL_CATALOG_SEED.map(mapPublicSeedToCatalogProduct),
  ...mockCatalogRows,
];

export function buildCatalogProductSearchHaystack(p: CatalogProduct): string {
  return [
    p.name,
    p.article,
    p.series,
    p.category,
    p.doorKind,
    p.coating,
    p.type,
    p.shortDescription,
    p.description,
    ...(p.features ?? []),
    ...(p.catalogTags ?? []),
    ...(p.catalogImages ?? []).map((c) => c.alt),
    p.catalogSearchText ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Поиск по каталогу: короткие ВХ/МК; несколько слов — OR по вхождению в haystack. */
export function catalogSearchQueryMatchesHaystack(rawQuery: string, haystack: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  if (q === "вх" || q === "vh") return haystack.includes("входн") || haystack.includes("входная");
  if (q === "мк" || q === "mk") return haystack.includes("межкомнат");
  if (q === "входные" || (q.includes("входн") && q.length >= 4)) return haystack.includes("вход");
  if (q === "межкомнатные" || (q.includes("межкомнат") && q.length >= 6)) return haystack.includes("межкомнат");
  if (q === "фурнитура" || q === "замки" || q === "замок") {
    return haystack.includes("фурнитур") || haystack.includes("замок");
  }
  if (q.includes("ручк")) return haystack.includes("ручк");
  if (q.includes("петл")) return haystack.includes("петл");
  if (q.includes("термо")) return haystack.includes("терм");
  if (q.includes("бел")) return haystack.includes("бел");
  if (q.includes("графит")) return haystack.includes("графит");
  const parts = q.split(/\s+/).filter((w) => w.length > 0);
  if (parts.length >= 2) return parts.some((w) => w.length >= 2 && haystack.includes(w));
  return haystack.includes(q);
}

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
  if (product.status.includes("Требует") || product.status.includes("Ограничен") || !product.inStock) return "проверить наличие";
  if (!product.recommendedForShowcase) return "добавить в витрину";
  return "продаётся";
}

export type TradePointShowcaseRowStatus = "на витрине" | "запланировать" | "проверить выкладку";

export function tradePointShowcaseStatusForProduct(product: CatalogProduct): TradePointShowcaseRowStatus {
  if (product.recommendedForShowcase) return "на витрине";
  if (product.relatedTaskCount >= 2) return "проверить выкладку";
  return "запланировать";
}
