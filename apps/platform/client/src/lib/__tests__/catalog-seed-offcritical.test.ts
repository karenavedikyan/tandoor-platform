/**
 * Запуск: `npm run test:catalog-seed-offcritical` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TANDOOR_REAL_CATALOG_SEED } from "../tandoor-real-catalog-seed.generated.js";
import { segmentForModelTargetId } from "../showcase-model-segment.js";
import {
  MATRIX_MODEL_ORDER,
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
  type ShowcaseMatrixModelDefinition,
} from "../trade-point-showcase-matrix-models.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readNoSeedImport(relPath: string): void {
  const src = fs.readFileSync(path.resolve(here, relPath), "utf8");
  assert.ok(
    !src.includes('from "./tandoor-real-catalog-seed.generated'),
    `${relPath} must not import full seed`,
  );
}

readNoSeedImport("../showcase-model-segment.ts");
readNoSeedImport("../trade-point-showcase-matrix-models.ts");

const CATALOG_BY_ID = new Map(TANDOOR_REAL_CATALOG_SEED.map((p) => [p.id, p]));

function categoryToSegment(
  category: "entrance" | "interior" | "hardware" | "other",
): "vh" | "mk" | "hardware" | null {
  if (category === "entrance") return "vh";
  if (category === "interior") return "mk";
  if (category === "hardware") return "hardware";
  return null;
}

function segmentFromIdPrefix(targetId: string): "vh" | "mk" | "hardware" | null {
  if (targetId.startsWith("tc-vh-")) return "vh";
  if (targetId.startsWith("tc-mk-")) return "mk";
  if (targetId.startsWith("tc-hw-")) return "hardware";
  return null;
}

function legacySegmentForModelTargetId(targetId: string): "vh" | "mk" | "hardware" | null {
  const id = targetId.trim();
  if (!id) return null;

  const catalogItem = CATALOG_BY_ID.get(id);
  if (catalogItem) {
    const fromCatalog = categoryToSegment(catalogItem.category);
    if (fromCatalog) return fromCatalog;
  }

  const fromPrefix = segmentFromIdPrefix(id);
  if (fromPrefix) return fromPrefix;

  const def = SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((m) => m.id === id);
  if (def) {
    if (def.type === "entrance") return "vh";
    if (def.type === "interior") return "mk";
    if (def.type === "hardware") return "hardware";
  }

  return null;
}

const MATRIX_META: Record<string, Pick<ShowcaseMatrixModelDefinition, "basePriority" | "importanceReason">> = {
  "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya": {
    basePriority: "high",
    importanceReason:
      "Ходовая входная группа: узнаваемая отделка, хорошо смотрится на витрине рядом с конкурентами.",
  },
  "tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya": {
    basePriority: "high",
    importanceReason:
      "Текстурная входная модель — помогает показать премиальный сегмент без перегруза витрины.",
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

function catalogTypeToModelType(cat: "entrance" | "interior" | "hardware" | "other") {
  if (cat === "entrance") return "entrance";
  if (cat === "hardware") return "hardware";
  return "interior";
}

function typeLabel(type: "entrance" | "interior" | "hardware") {
  if (type === "entrance") return "ВХ";
  if (type === "hardware") return "Фурнитура";
  return "МК";
}

function legacyBuildDefinitions(): ShowcaseMatrixModelDefinition[] {
  const seedById = new Map(TANDOOR_REAL_CATALOG_SEED.map((p) => [p.id, p]));
  const out: ShowcaseMatrixModelDefinition[] = [];
  for (const id of MATRIX_MODEL_ORDER) {
    const seed = seedById.get(id);
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
      characteristics: "",
      advantages: "",
      benefitsDealer: "",
      benefitsBuyer: "",
      objections: "",
      objectionAnswers: "",
      copyMessage: "",
    });
  }
  return out;
}

{
  const legacy = legacyBuildDefinitions();
  assert.equal(legacy.length, SHOWCASE_MATRIX_MODEL_DEFINITIONS.length);
  for (let i = 0; i < legacy.length; i += 1) {
    const a = legacy[i]!;
    const b = SHOWCASE_MATRIX_MODEL_DEFINITIONS[i]!;
    assert.equal(a.id, b.id);
    assert.equal(a.name, b.name);
    assert.equal(a.type, b.type);
    assert.equal(a.typeLabelRu, b.typeLabelRu);
    assert.equal(a.imageUrl, b.imageUrl);
    assert.equal(a.basePriority, b.basePriority);
    assert.equal(a.importanceReason, b.importanceReason);
  }
}

const SEGMENT_CASES = [
  "tc-vh-custom-model",
  "tc-mk-custom-model",
  "tc-hw-custom-model",
  "tc-vh-astra-bukle-opal-belyy-matovyy-960kh2200-levaya",
  "tc-mk-dekanto-belyy-evo-pet-dg-2000-800",
  "tc-hw-ruchka-dvernaya-tandoor-tdal-701-02-black-chernyy-td185225",
  "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya",
  "tc-mk-m-36-emal-belaya-dg-2000-800",
  "unknown-model-id",
  "",
];

for (const id of SEGMENT_CASES) {
  assert.equal(
    segmentForModelTargetId(id),
    legacySegmentForModelTargetId(id),
    `segment mismatch for ${JSON.stringify(id)}`,
  );
}

console.log("catalog-seed-offcritical: ok");
