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

const P1_P2_PAGES: Array<{ page: string; skeleton: string; loadingPattern: RegExp }> = [
  { page: "pages/trade-point-detail.tsx", skeleton: "TradePointDetailSkeleton", loadingPattern: /TradePointDetailSkeleton/ },
  { page: "pages/assignment-detail.tsx", skeleton: "AssignmentDetailSkeleton", loadingPattern: /AssignmentDetailSkeleton/ },
  { page: "pages/tasks.tsx", skeleton: "TasksSkeleton", loadingPattern: /TasksSkeleton/ },
  { page: "pages/catalog.tsx", skeleton: "CatalogSkeleton", loadingPattern: /CatalogSkeleton/ },
  { page: "pages/analytics.tsx", skeleton: "AnalyticsSkeleton", loadingPattern: /AnalyticsSkeleton/ },
  { page: "pages/training-wiki-map.tsx", skeleton: "TrainingWikiMapSkeleton", loadingPattern: /TrainingWikiMapSkeleton/ },
  { page: "pages/admin-users.tsx", skeleton: "AdminUsersSkeleton", loadingPattern: /AdminUsersSkeleton/ },
  { page: "pages/training.tsx", skeleton: "TrainingSkeleton", loadingPattern: /TrainingSkeleton/ },
  { page: "pages/marketing-briefs.tsx", skeleton: "MarketingBriefsSkeleton", loadingPattern: /MarketingBriefsSkeleton/ },
  { page: "pages/product-detail.tsx", skeleton: "ProductDetailSkeleton", loadingPattern: /ProductDetailSkeleton/ },
  { page: "pages/catalog-product-1c.tsx", skeleton: "CatalogProduct1cSkeleton", loadingPattern: /CatalogProduct1cSkeleton/ },
  { page: "pages/sales-manager-workspace.tsx", skeleton: "SalesManagerWorkspaceSkeleton", loadingPattern: /SalesManagerWorkspaceSkeleton/ },
  { page: "pages/communications.tsx", skeleton: "CommunicationsSkeleton", loadingPattern: /CommunicationsSkeleton/ },
  { page: "pages/sales-control-director.tsx", skeleton: "SalesControlDirectorSkeleton", loadingPattern: /SalesControlDirectorSkeleton/ },
];

for (const { page, skeleton, loadingPattern } of [...P0_PAGES, ...P1_P2_PAGES]) {
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
  "components/skeletons/trade-point-detail-skeleton.tsx",
  "components/skeletons/assignment-detail-skeleton.tsx",
  "components/skeletons/tasks-skeleton.tsx",
  "components/skeletons/catalog-skeleton.tsx",
  "components/skeletons/analytics-skeleton.tsx",
  "components/skeletons/training-wiki-map-skeleton.tsx",
  "components/skeletons/admin-users-skeleton.tsx",
  "components/skeletons/training-skeleton.tsx",
  "components/skeletons/marketing-briefs-skeleton.tsx",
  "components/skeletons/product-detail-skeleton.tsx",
  "components/skeletons/catalog-product-1c-skeleton.tsx",
  "components/skeletons/sales-manager-workspace-skeleton.tsx",
  "components/skeletons/communications-skeleton.tsx",
  "components/skeletons/sales-control-director-skeleton.tsx",
];

for (const f of skeletonFiles) {
  const src = read(f);
  assert.ok(src.includes('data-testid="page-skeleton"'), `${f} has page-skeleton testid`);
}

console.log("skeletons-render: ok");
