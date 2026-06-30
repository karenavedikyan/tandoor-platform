/**
 * Запуск: `npm run test:catalog-category-tree` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  buildCategoryTree,
  dedupeCategoriesById,
  findCategoryPath,
  resolveCategoryFilterLevels,
  type CatalogCategoryFlat,
} from "../catalog-category-tree.js";

const sampleFlat: CatalogCategoryFlat[] = [
  { id: "entry", name: "Входные двери", parent_id: null, sort_order: 1, product_count: 100 },
  { id: "interior", name: "Межкомнатные двери", parent_id: null, sort_order: 2, product_count: 200 },
  { id: "floor", name: "Напольные покрытия", parent_id: null, sort_order: 3, product_count: 80 },
  { id: "entry-constr", name: "по конструкции", parent_id: "entry", sort_order: 1, product_count: 40 },
  { id: "entry-mat", name: "по материалу", parent_id: "entry", sort_order: 2, product_count: 30 },
  { id: "interior-coat", name: "по покрытию", parent_id: "interior", sort_order: 1, product_count: 70 },
  { id: "interior-type", name: "по типу", parent_id: "interior", sort_order: 2, product_count: 60 },
  { id: "interior-color", name: "по цвету", parent_id: "interior", sort_order: 3, product_count: 50 },
  { id: "laminate", name: "ламинат", parent_id: "floor", sort_order: 1, product_count: 40 },
  { id: "brand-a", name: "Бренд A", parent_id: "laminate", sort_order: 1, product_count: 10 },
  { id: "brand-b", name: "Бренд B", parent_id: "laminate", sort_order: 2, product_count: 12 },
];

{
  const withDupes: CatalogCategoryFlat[] = [
    ...sampleFlat,
    { id: "dup", name: "дубликат", parent_id: "interior", sort_order: 4, product_count: 1 },
    { id: "dup", name: "дубликат", parent_id: "interior", sort_order: 4, product_count: 1 },
  ];
  const deduped = dedupeCategoriesById(withDupes);
  assert.equal(deduped.length, sampleFlat.length + 1);
}

{
  const roots = buildCategoryTree(sampleFlat);
  assert.equal(roots.length, 3);
  assert.equal(roots[0]!.id, "entry");
  assert.equal(roots[1]!.id, "interior");
  assert.equal(roots[2]!.id, "floor");

  const interior = roots.find((r) => r.id === "interior")!;
  assert.equal(interior.children.length, 3);
  assert.deepEqual(
    interior.children.map((c) => c.name),
    ["по покрытию", "по типу", "по цвету"],
  );

  const floor = roots.find((r) => r.id === "floor")!;
  const laminate = floor.children.find((c) => c.id === "laminate")!;
  assert.equal(laminate.children.length, 2);
}

{
  const roots = buildCategoryTree(sampleFlat);
  const path = findCategoryPath(roots, "brand-a");
  assert.deepEqual(
    path.map((n) => n.id),
    ["floor", "laminate", "brand-a"],
  );
}

{
  const allLevels = resolveCategoryFilterLevels(sampleFlat, "all");
  assert.equal(allLevels.activeRootId, null);
  assert.equal(allLevels.subsections.length, 0);
  assert.equal(allLevels.leaves.length, 0);
}

{
  const interiorLevels = resolveCategoryFilterLevels(sampleFlat, "interior");
  assert.equal(interiorLevels.activeRootId, "interior");
  assert.equal(interiorLevels.subsections.length, 3);
  assert.equal(interiorLevels.leaves.length, 0);
}

{
  const coatLevels = resolveCategoryFilterLevels(sampleFlat, "interior-coat");
  assert.equal(coatLevels.activeRootId, "interior");
  assert.equal(coatLevels.activeSubsectionId, "interior-coat");
  assert.equal(coatLevels.leaves.length, 0);
}

{
  const brandLevels = resolveCategoryFilterLevels(sampleFlat, "brand-b");
  assert.equal(brandLevels.activeRootId, "floor");
  assert.equal(brandLevels.activeSubsectionId, "laminate");
  assert.equal(brandLevels.leaves.length, 2);
  assert.deepEqual(
    brandLevels.leaves.map((n) => n.id),
    ["brand-a", "brand-b"],
  );
}

console.log("catalog-category-tree: ok");
