/**
 * Запуск: `npm run test:skeletons-render` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(path.join(clientSrc, rel), "utf8");
}

const P0_PAGES: Array<{ page: string; skeleton: string; loadingPattern: RegExp }> = [
  { page: "pages/dealer-base.tsx", skeleton: "DealerBaseSkeleton", loadingPattern: /isPageInitialLoading/ },
  { page: "pages/trade-points.tsx", skeleton: "TradePointsSkeleton", loadingPattern: /isPageInitialLoading/ },
  { page: "pages/dealer-card-foundation.tsx", skeleton: "DealerCardSkeleton", loadingPattern: /DealerCardSkeleton/ },
  {
    page: "pages/dealer-base-management-cockpit.tsx",
    skeleton: "ManagementCockpitSkeleton",
    loadingPattern: /ManagementCockpitSkeleton/,
  },
  {
    page: "pages/trade-points-management-cockpit.tsx",
    skeleton: "ManagementCockpitSkeleton",
    loadingPattern: /ManagementCockpitSkeleton/,
  },
  { page: "pages/trash-bin.tsx", skeleton: "TrashBinSkeleton", loadingPattern: /TrashBinSkeleton/ },
];

for (const { page, skeleton, loadingPattern } of P0_PAGES) {
  const src = read(page);
  assert.ok(src.includes(skeleton), `${page} imports/uses ${skeleton}`);
  assert.ok(loadingPattern.test(src), `${page} has loading gate`);
}

const skeletonFiles = [
  "components/skeletons/dealer-base-skeleton.tsx",
  "components/skeletons/trade-points-skeleton.tsx",
  "components/skeletons/dealer-card-skeleton.tsx",
  "components/skeletons/management-cockpit-skeleton.tsx",
  "components/skeletons/trash-bin-skeleton.tsx",
];

for (const f of skeletonFiles) {
  const src = read(f);
  assert.ok(src.includes('data-testid="page-skeleton"'), `${f} has page-skeleton testid`);
}

console.log("skeletons-render: ok");
