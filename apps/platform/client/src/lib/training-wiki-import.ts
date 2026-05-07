import { WIKI_TRAINING_IMPORT_SEED, wikiSeedMaterialId, type WikiTrainingImportSeedItem } from "./training-wiki-import-data";
import type { TaskInsightDomain } from "./trade-point-task-data";

export type { WikiTrainingImportSeedItem } from "./training-wiki-import-data";

/** Совместимость с `TrainingMaterial` без циклического импорта `training-data`. */
export type WikiImportedMaterialShape = {
  id: string;
  title: string;
  section: "product" | "sales" | "onboarding" | "regulations" | "development";
  type: "article" | "course" | "script" | "comparison" | "regulation" | "faq" | "video";
  audience: ("employees" | "dealers" | "managers" | "regional_managers" | "purchasing" | "all")[];
  status: "required" | "recommended" | "new" | "updated";
  description: string;
  readTimeMinutes: number;
  progressPercent: number;
  relatedProductIds: string[];
  relatedTaskIds: string[];
  tags: string[];
  updatedAt: string;
  contentBlocks: Array<{ heading: string; body: string }>;
  programIds: string[];
  durationMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  required: boolean;
  progressStatus: "not_started" | "in_progress" | "completed";
  knowledgeTags: string[];
  relatedTaskContext: ("showcase" | "hardware" | "orders" | "dealer_card" | "territory" | "analytics")[];
  checklist: string[];
  summaryBullets: string[];
  sourceType: "wiki";
  wikiSource: {
    sourceType: "wiki";
    wikiPageId?: number;
    wikiTitle: string;
    wikiImportedAt: string;
    wikiReviewStatus: "needs_review" | "approved" | "archived";
    wikiSectionGuess: "product" | "sales" | "onboarding" | "regulations" | "development" | "other";
    wikiCharCount: number;
  };
  originalTitle: string;
  reviewStatus: "needs_review" | "approved" | "archived";
  wikiCatalogLine?: "mk" | "vh" | "hardware" | "all";
};

function mapSection(seed: WikiTrainingImportSeedItem): WikiImportedMaterialShape["section"] {
  if (seed.section === "other") return "development";
  return seed.section;
}

function programIdsForWikiSection(section: WikiImportedMaterialShape["section"]): string[] {
  if (section === "product") return ["prog-product-lines"];
  if (section === "sales") return ["prog-sales-hits"];
  if (section === "onboarding") return ["prog-adapt-2026"];
  if (section === "regulations") return ["prog-regional-control"];
  return ["prog-adapt-2026"];
}

function contextsForWikiSection(section: WikiImportedMaterialShape["section"]): WikiImportedMaterialShape["relatedTaskContext"] {
  if (section === "product") return ["showcase", "hardware", "dealer_card"];
  if (section === "sales") return ["analytics", "dealer_card"];
  if (section === "regulations") return ["orders", "territory", "dealer_card"];
  if (section === "onboarding") return ["dealer_card", "orders"];
  return ["analytics"];
}

function wikiMaterialType(seed: WikiTrainingImportSeedItem): WikiImportedMaterialShape["type"] {
  if (seed.section === "regulations") return "regulation";
  if (seed.section === "sales") return "article";
  return "article";
}

function wikiStatus(seed: WikiTrainingImportSeedItem): WikiImportedMaterialShape["status"] {
  if (seed.reviewStatus === "approved") return "updated";
  if (seed.reviewStatus === "archived") return "recommended";
  return "new";
}

function difficultyFromChars(n: number): WikiImportedMaterialShape["difficulty"] {
  if (n > 12000) return "hard";
  if (n < 3500) return "easy";
  return "medium";
}

export function normalizeWikiTrainingItem(seed: WikiTrainingImportSeedItem): WikiImportedMaterialShape {
  const id = wikiSeedMaterialId(seed.title);
  const section = mapSection(seed);
  const readTime = Math.max(5, Math.min(45, Math.round(seed.charCount / 400)));
  const wikiSource: WikiImportedMaterialShape["wikiSource"] = {
    sourceType: "wiki",
    wikiPageId: seed.pageId,
    wikiTitle: seed.title,
    wikiImportedAt: seed.importedAt,
    wikiReviewStatus: seed.reviewStatus,
    wikiSectionGuess: seed.section === "other" ? "other" : section,
    wikiCharCount: seed.charCount,
  };
  const audience: WikiImportedMaterialShape["audience"] =
    section === "sales" ? ["managers", "regional_managers"] : section === "regulations" ? ["managers", "dealers"] : ["managers", "dealers", "employees"];
  const bullets = [seed.summary, seed.contentBlocks[0]?.body?.slice(0, 140) ?? ""].filter(Boolean);
  const mat: WikiImportedMaterialShape = {
    id,
    title: seed.title,
    section,
    type: wikiMaterialType(seed),
    audience,
    status: wikiStatus(seed),
    description: seed.summary,
    readTimeMinutes: readTime,
    progressPercent: seed.reviewStatus === "approved" ? 25 : 0,
    relatedProductIds: [...(seed.linkedProductIds ?? [])],
    relatedTaskIds: [],
    tags: [...seed.categories],
    updatedAt: seed.importedAt,
    contentBlocks: seed.contentBlocks,
    programIds: programIdsForWikiSection(section),
    durationMinutes: readTime,
    difficulty: difficultyFromChars(seed.charCount),
    required: false,
    progressStatus: (seed.reviewStatus === "approved" ? "in_progress" : "not_started") as WikiImportedMaterialShape["progressStatus"],
    knowledgeTags: [...seed.knowledgeTags],
    relatedTaskContext: contextsForWikiSection(section),
    checklist: [
      "Просмотреть нормализованный материал",
      "Сверить с актуальной версией во внутренней базе после ревью",
      "Зафиксировать вопросы наставнику",
    ],
    summaryBullets: bullets,
    sourceType: "wiki",
    wikiSource,
    originalTitle: seed.title,
    reviewStatus: seed.reviewStatus,
    wikiCatalogLine: seed.relatedProductCategory ?? undefined,
  };
  return mat;
}

let _wikiCache: WikiImportedMaterialShape[] | null = null;

export function getWikiImportedTrainingMaterials(): WikiImportedMaterialShape[] {
  if (!_wikiCache) {
    _wikiCache = WIKI_TRAINING_IMPORT_SEED.map(normalizeWikiTrainingItem);
  }
  return _wikiCache;
}

export function getWikiTrainingImportSummary() {
  const mats = getWikiImportedTrainingMaterials();
  const needsReview = mats.filter((m) => m.reviewStatus === "needs_review" || m.wikiSource?.wikiReviewStatus === "needs_review").length;
  const bySection: Record<string, number> = {
    product: 0,
    sales: 0,
    onboarding: 0,
    regulations: 0,
    development: 0,
    other: 0,
  };
  for (const m of mats) {
    const g = m.wikiSource?.wikiSectionGuess ?? m.section;
    if (g in bySection) bySection[g] += 1;
    else bySection.other += 1;
  }
  return {
    totalImported: mats.length,
    needsReview,
    approved: mats.filter((m) => m.reviewStatus === "approved").length,
    archived: mats.filter((m) => m.reviewStatus === "archived").length,
    bySection,
  };
}

export function getWikiTrainingMaterialsByReviewStatus(
  status: WikiImportedMaterialShape["wikiSource"]["wikiReviewStatus"],
): WikiImportedMaterialShape[] {
  return getWikiImportedTrainingMaterials().filter((m) => m.reviewStatus === status);
}

export function getWikiTrainingMaterialsBySection(section: WikiImportedMaterialShape["section"]): WikiImportedMaterialShape[] {
  return getWikiImportedTrainingMaterials().filter((m) => m.section === section);
}

/** Для подбора материала по задаче: приоритет Wiki-материала при совпадении домена. */

export function pickWikiMaterialIdForTaskInsight(
  insightDomain: TaskInsightDomain | undefined,
  productLine: "mk" | "vh" | "hardware" | null,
): string | undefined {
  const wiki = getWikiImportedTrainingMaterials();
  const byLine = (line: "mk" | "vh" | "hardware") =>
    wiki.find((m) => {
      if (line === "mk") return m.section === "product" && (m.title.includes("МК") || m.knowledgeTags.some((t) => t.includes("МК")));
      if (line === "vh") return m.section === "product" && (m.title.includes("Вход") || m.knowledgeTags.some((t) => t.includes("ВХ")));
      return m.knowledgeTags.some((t) => t.toLowerCase().includes("фурнитур")) || m.title.includes("Замк");
    });
  if (productLine === "mk") return byLine("mk")?.id;
  if (productLine === "vh") return byLine("vh")?.id;
  if (productLine === "hardware") return byLine("hardware")?.id;
  if (insightDomain === "analytics") {
    return wiki.find((m) => m.section === "sales" && m.title.includes("7 правил"))?.id ?? wiki.find((m) => m.section === "sales")?.id;
  }
  if (insightDomain === "showcase") return wiki.find((m) => m.title.includes("презентации"))?.id;
  if (insightDomain === "hardware") return wiki.find((m) => m.title.includes("Замк"))?.id;
  if (insightDomain === "territory" || insightDomain === "equipment") {
    return wiki.find((m) => m.section === "regulations" && m.title.includes("Рекламации"))?.id;
  }
  return undefined;
}
