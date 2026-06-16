import { TANDOOR_REAL_CATALOG_SEED } from "@/lib/tandoor-real-catalog-seed.generated";

export type ShowcaseMatrixModelType = "entrance" | "interior" | "hardware";

export type ShowcaseMatrixTypeLabelRu = "ВХ" | "МК" | "Фурнитура";

export type ShowcaseMatrixPriorityRank = "high" | "medium" | "low";

export type ShowcaseMatrixModelDefinition = {
  id: string;
  /** UUID товара в каталоге 1С, если известен. */
  catalog1cId?: string;
  name: string;
  type: ShowcaseMatrixModelType;
  typeLabelRu: ShowcaseMatrixTypeLabelRu;
  imageUrl: string;
  basePriority: ShowcaseMatrixPriorityRank;
  importanceReason: string;
  characteristics: string;
  advantages: string;
  benefitsDealer: string;
  benefitsBuyer: string;
  objections: string;
  objectionAnswers: string;
  copyMessage: string;
};

const SEED_BY_ID = new Map(TANDOOR_REAL_CATALOG_SEED.map((p) => [p.id, p]));

/** Порядок фиксирован: без случайных перестановок. */
/** Порядок влияет на состав стартовой/базовой матрицы (чередование ВХ и МК в начале списка). */
const MATRIX_MODEL_ORDER: readonly string[] = [
  "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya",
  "tc-mk-baget-12-mokko-pet-dg-2000-800-94",
  "tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya",
  "tc-mk-grand-13-medzhik-pet-dg-2000-800",
  "tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya",
  "tc-vh-ultra-pikhtovyy-emalit-belyy-860kh2050-levaya",
  "tc-mk-baget-13-makiato-pet-dg-2000-800-91",
  "tc-mk-m-36-emal-belaya-dg-2000-800",
] as const;

/** TODO: legacy-поля презентации в типе модели — для stub-совместимости; контент берётся из каталога 1С. */
const EMPTY_LEGACY_PRESENTATION = {
  characteristics: "",
  advantages: "",
  benefitsDealer: "",
  benefitsBuyer: "",
  objections: "",
  objectionAnswers: "",
  copyMessage: "",
} as const;

const MATRIX_META: Record<
  string,
  Pick<ShowcaseMatrixModelDefinition, "basePriority" | "importanceReason">
> = {
  "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya": {
    basePriority: "high",
    importanceReason: "Ходовая входная группа: узнаваемая отделка, хорошо смотрится на витрине рядом с конкурентами.",
  },
  "tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya": {
    basePriority: "high",
    importanceReason: "Текстурная входная модель — помогает показать премиальный сегмент без перегруза витрины.",
  },
  "tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya": {
    basePriority: "medium",
    importanceReason: "Тёплое дерево + белый внутри — универсальный запрос на входную группу.",
  },
  "tc-vh-ultra-pikhtovyy-emalit-belyy-860kh2050-levaya": {
    basePriority: "medium",
    importanceReason: "Натуралистичная фактура «пихта» — отличает витрину от однотипных гладких решений.",
  },
  "tc-mk-baget-12-mokko-pet-dg-2000-800-94": {
    basePriority: "high",
    importanceReason: "Межкомнатная серия с узнаваемым профилем — быстрый старт разговора про МК.",
  },
  "tc-mk-grand-13-medzhik-pet-dg-2000-800": {
    basePriority: "high",
    importanceReason: "Широкая линейка «Гранд» — помогает показать шаг вверх по дизайну МК.",
  },
  "tc-mk-baget-13-makiato-pet-dg-2000-800-91": {
    basePriority: "medium",
    importanceReason: "Расширение линейки «Багет» — показывает вариативность цвета в одной системе профилей.",
  },
  "tc-mk-m-36-emal-belaya-dg-2000-800": {
    basePriority: "low",
    importanceReason: "Классическая белая эмаль — must-have для витрины МК в любом сегменте клиента.",
  },
};

function catalogTypeToModelType(cat: "entrance" | "interior" | "hardware" | "other"): ShowcaseMatrixModelType {
  if (cat === "entrance") return "entrance";
  if (cat === "hardware") return "hardware";
  return "interior";
}

export function showcaseMatrixTypeLabelRu(type: ShowcaseMatrixModelType): ShowcaseMatrixTypeLabelRu {
  if (type === "entrance") return "ВХ";
  if (type === "hardware") return "Фурнитура";
  return "МК";
}

function typeLabel(type: ShowcaseMatrixModelType): ShowcaseMatrixTypeLabelRu {
  return showcaseMatrixTypeLabelRu(type);
}

function buildDefinitions(): ShowcaseMatrixModelDefinition[] {
  const out: ShowcaseMatrixModelDefinition[] = [];
  for (const id of MATRIX_MODEL_ORDER) {
    const seed = SEED_BY_ID.get(id);
    const meta = MATRIX_META[id];
    if (!seed || !meta) continue;
    const type = catalogTypeToModelType(seed.category);
    out.push({
      id,
      name: seed.title,
      type,
      typeLabelRu: typeLabel(type),
      imageUrl: seed.imageSrc,
      ...meta,
      ...EMPTY_LEGACY_PRESENTATION,
    });
  }
  return out;
}

export const SHOWCASE_MATRIX_MODEL_DEFINITIONS: ShowcaseMatrixModelDefinition[] = buildDefinitions();

/** Человеко-читаемый лейбл приоритета матрицы ТТ. high = Обязательная, medium = Рекомендованная, low = «—». */
export function priorityLabelRu(p: ShowcaseMatrixPriorityRank): "Обязательная" | "Рекомендованная" | "—" {
  if (p === "high") return "Обязательная";
  if (p === "medium") return "Рекомендованная";
  return "—";
}

/**
 * Минимальная модель презентации для произвольного товара каталога 1С.
 * Контент (характеристики/преимущества/выгоды) диалог строит из свойств 1С по catalog1cId.
 * Используется при открытии презентации из карточки каталога (вне матрицы/задания).
 */
export function buildPresentationModelFromCatalogProduct(input: {
  /** UUID товара в каталоге 1С. */
  id: string;
  name: string;
  /** "entrance" — входная дверь (ВХ), иначе — межкомнатная (МК). */
  type?: ShowcaseMatrixModelType;
  imageUrl?: string;
}): ShowcaseMatrixModelDefinition {
  const type: ShowcaseMatrixModelType = input.type ?? "interior";
  return {
    id: input.id,
    catalog1cId: input.id,
    name: input.name,
    type,
    typeLabelRu: showcaseMatrixTypeLabelRu(type),
    imageUrl: input.imageUrl ?? "",
    basePriority: "medium",
    importanceReason: "",
    characteristics: EMPTY_LEGACY_PRESENTATION.characteristics,
    advantages: EMPTY_LEGACY_PRESENTATION.advantages,
    benefitsDealer: EMPTY_LEGACY_PRESENTATION.benefitsDealer,
    benefitsBuyer: EMPTY_LEGACY_PRESENTATION.benefitsBuyer,
    objections: EMPTY_LEGACY_PRESENTATION.objections,
    objectionAnswers: EMPTY_LEGACY_PRESENTATION.objectionAnswers,
    copyMessage: EMPTY_LEGACY_PRESENTATION.copyMessage,
  };
}

export function resolveCatalog1cId(m: ShowcaseMatrixModelDefinition): string | null {
  return m.catalog1cId ?? null;
}

/** Ссылка на карточку каталога: напрямую в 1С при известном UUID, иначе через legacy-мост. */
export function catalogHrefForMatrixModel(m: ShowcaseMatrixModelDefinition): string {
  if (m.catalog1cId) return `/catalog/1c/${m.catalog1cId}`;
  return `/catalog/${m.id}`;
}
