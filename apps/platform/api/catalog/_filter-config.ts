/** Корневые категории catalog_categories (фактические GUID из 1С в БД). */
export const ROOT_CATEGORY_IDS = {
  ENTRANCE: "5ac286c2-c158-11ec-8116-00155d0a0a4e",
  INTERIOR: "342a9a43-c159-11ec-8116-00155d0a0a4e",
  PLINTH: "a243849d-a79d-11ed-8126-00155d0a0a4e",
  MOLDING: "dce6990b-c159-11ec-8116-00155d0a0a4e",
  HARDWARE: "e7386898-c159-11ec-8116-00155d0a0a4e",
  FLOORING: "cf1d70a8-85ad-11ed-8126-00155d0a0a4e",
} as const;

export type FilterGroupKind = "checkbox" | "range_buckets" | "boolean";

export type RangeBucketDef = {
  label: string;
  min?: number;
  max?: number;
};

export type FilterGroupDef = {
  /** Ключ группы в API / props (обычно = propName). */
  key: string;
  propName: string;
  /** Несколько свойств 1С в одной группе (напр. Материал + Покрытие). */
  propNames?: string[];
  label: string;
  kind: FilterGroupKind;
  order: number;
  buckets?: RangeBucketDef[];
};

export const PROPERTY_BLACKLIST = new Set([
  "Условия эксплуатации",
  "Гарантийный срок",
  "Гарантийные обязательства",
  "Указания по эксплуатации",
  "Комплектующие",
  "Вид комплекта",
  "Название для сайта",
  "сайт Тандор",
  "Главная",
  "Акция",
  "СсылкаНаГлавную",
  "АкцияДействуетС_Тандор_ОПТ",
  "АкцияДействуетС_Оптовик",
  "Производитель",
  "Количество в упаковке (шт)",
  "В одной упаковке (м)",
]);

/** Гео-значения, не показываем в «Бренд». */
export const BRAND_GEO_BLOCKLIST = new Set([
  "россия",
  "китай",
  "респ.беларусь",
  "беларусь",
  "йошкар-ола",
  "россия, г. ростов-на-дону",
  "россия г. вологда",
]);

export const LEAF_THICKNESS_BUCKETS: RangeBucketDef[] = [
  { label: "до 69 мм", max: 69 },
  { label: "от 70 до 89 мм", min: 70, max: 89 },
  { label: "от 90 до 99 мм", min: 90, max: 99 },
  { label: "100 мм и более", min: 100 },
];

export const STEEL_THICKNESS_BUCKETS: RangeBucketDef[] = [
  { label: "до 0,99 мм", max: 0.99 },
  { label: "от 1 до 1,49 мм", min: 1, max: 1.49 },
  { label: "от 1,5 до 2 мм", min: 1.5, max: 2 },
];

const INTERIOR_GROUPS: FilterGroupDef[] = [
  { key: "Дизайн", propName: "Дизайн", label: "Дизайн", kind: "checkbox", order: 10 },
  { key: "Цветовая гамма", propName: "Цветовая гамма", label: "Цветовая гамма", kind: "checkbox", order: 20 },
  {
    key: "Материал\\Покрытие",
    propName: "Материал\\Покрытие",
    propNames: ["Материал\\Покрытие", "Материал", "Покрытие"],
    label: "Материал / Покрытие",
    kind: "checkbox",
    order: 30,
  },
  { key: "Вид двери", propName: "Вид двери", label: "Вид двери", kind: "checkbox", order: 40 },
];

const ENTRANCE_GROUPS: FilterGroupDef[] = [
  { key: "Место назначения", propName: "ВХ. По назначению", propNames: ["ВХ. По назначению", "Место назначения"], label: "Место назначения", kind: "checkbox", order: 10 },
  { key: "Вид двери", propName: "МТ.Вид двери", propNames: ["МТ.Вид двери", "Вид двери"], label: "Вид двери", kind: "checkbox", order: 20 },
  {
    key: "Толщина полотна, мм",
    propName: "Толщина полотна, мм",
    label: "Толщина полотна, мм",
    kind: "range_buckets",
    order: 30,
    buckets: LEAF_THICKNESS_BUCKETS,
  },
  {
    key: "Толщина стали, мм",
    propName: "Толщина стали, мм",
    label: "Толщина стали, мм",
    kind: "range_buckets",
    order: 40,
    buckets: STEEL_THICKNESS_BUCKETS,
  },
  { key: "Терморазрыв", propName: "ВХ. Терморазрыв", propNames: ["ВХ. Терморазрыв", "Терморазрыв"], label: "Терморазрыв", kind: "boolean", order: 50 },
  { key: "Ковка", propName: "ВХ. Ковка", propNames: ["ВХ. Ковка", "Ковка"], label: "Ковка", kind: "boolean", order: 60 },
  { key: "Стеклопакет", propName: "ВХ. Стеклопакет", propNames: ["ВХ. Стеклопакет", "Стеклопакет"], label: "Стеклопакет", kind: "boolean", order: 70 },
  { key: "Зеркало", propName: "ВХ. Зеркало", propNames: ["ВХ. Зеркало", "Зеркало"], label: "Зеркало", kind: "boolean", order: 80 },
];

const PLINTH_GROUPS: FilterGroupDef[] = [
  { key: "Материал", propName: "Материал", label: "Материал", kind: "checkbox", order: 10 },
  { key: "Цвет", propName: "Цвет", label: "Цвет", kind: "checkbox", order: 20 },
];

const HARDWARE_GROUPS: FilterGroupDef[] = [
  { key: "Вид ручки", propName: "ФР. Вид ручки", propNames: ["ФР. Вид ручки", "Вид ручки"], label: "Вид ручки", kind: "checkbox", order: 10 },
  { key: "Основание ручки", propName: "ФР. Основание ручки", propNames: ["ФР. Основание ручки", "Основание ручки"], label: "Основание ручки", kind: "checkbox", order: 20 },
  { key: "Тип установки", propName: "ФР. Тип установки", propNames: ["ФР. Тип установки", "Тип установки"], label: "Тип установки", kind: "checkbox", order: 30 },
  { key: "Размер петли", propName: "ФР.Размер петли", propNames: ["ФР.Размер петли", "Высота петли"], label: "Размер петли", kind: "checkbox", order: 40 },
];

const MOLDING_GROUPS: FilterGroupDef[] = [
  { key: "Материал", propName: "Материал", label: "Материал", kind: "checkbox", order: 10 },
  { key: "Цвет", propName: "Цвет", label: "Цвет", kind: "checkbox", order: 20 },
];

/** «Все разделы» — только общие чистые свойства. */
export const DEFAULT_FILTER_GROUPS: FilterGroupDef[] = [
  { key: "Бренд", propName: "Бренд", label: "Бренд", kind: "checkbox", order: 10 },
  { key: "Цвет", propName: "Цвет", label: "Цвет", kind: "checkbox", order: 20 },
];

export const FILTERS_BY_ROOT_CATEGORY: Record<string, FilterGroupDef[]> = {
  [ROOT_CATEGORY_IDS.INTERIOR]: INTERIOR_GROUPS,
  [ROOT_CATEGORY_IDS.ENTRANCE]: ENTRANCE_GROUPS,
  [ROOT_CATEGORY_IDS.PLINTH]: PLINTH_GROUPS,
  [ROOT_CATEGORY_IDS.HARDWARE]: HARDWARE_GROUPS,
  [ROOT_CATEGORY_IDS.MOLDING]: MOLDING_GROUPS,
};

/** Резолв по имени корневой категории (если UUID в конфиге не совпал). */
const FILTERS_BY_ROOT_NAME: Record<string, FilterGroupDef[]> = {
  "межкомнатные двери": INTERIOR_GROUPS,
  "входные двери": ENTRANCE_GROUPS,
  "плинтус напольный": PLINTH_GROUPS,
  "фурнитура": HARDWARE_GROUPS,
  "погонажные изделия": MOLDING_GROUPS,
};

export function getFilterGroupsForRoot(
  rootCategoryId: string | null,
  rootCategoryName: string | null,
): FilterGroupDef[] {
  if (rootCategoryId === ROOT_CATEGORY_IDS.FLOORING) return [];
  if (rootCategoryId && FILTERS_BY_ROOT_CATEGORY[rootCategoryId]) {
    return FILTERS_BY_ROOT_CATEGORY[rootCategoryId];
  }
  const nameKey = rootCategoryName?.trim().toLowerCase() ?? "";
  if (nameKey && FILTERS_BY_ROOT_NAME[nameKey]) {
    return FILTERS_BY_ROOT_NAME[nameKey];
  }
  return DEFAULT_FILTER_GROUPS;
}

export function findFilterGroupDef(
  groups: FilterGroupDef[],
  key: string,
): FilterGroupDef | undefined {
  return groups.find((g) => g.key === key);
}

export function propNamesForGroup(def: FilterGroupDef): string[] {
  return def.propNames?.length ? def.propNames : [def.propName];
}
