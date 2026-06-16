import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ModelCardHeader } from "@/components/model-card/model-card-header";
import { ModelCardKpiTiles } from "@/components/model-card/model-card-kpi-tiles";
import { ModelCardCitiesTable } from "@/components/model-card/model-card-cities-table";
import { ModelCardTradePointsTable } from "@/components/model-card/model-card-trade-points-table";
import { ModelCardGapTradePointsTable } from "@/components/model-card/model-card-gap-trade-points-table";
import { ModelCardCompetitorsSection } from "@/components/model-card/model-card-competitors-section";
import { useDistributionAnalyticsData } from "@/hooks/use-distribution-analytics-data";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { getProductById } from "@/lib/catalog-data";
import { buildHashPath, useHashRouteSearchParams } from "@/lib/hash-route-utils";
import { deserializeFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import {
  buildModelGapTradePoints,
  type AnalyticsTradePointRow,
} from "@/lib/distribution-analytics/distribution-analytics-view-models";
import { computeModelCoverage, type EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";
import { inferShowcasePortalTypeFromCatalogProduct } from "@/lib/trade-point-showcase-matrix-required";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import NotFound from "@/pages/not-found";

export default function ModelCardPage() {
  const params = useParams<{ modelId: string }>();
  const modelId = decodeURIComponent(params.modelId ?? "");
  const product = getProductById(modelId);
  const { profile } = useReleaseDemoProfile();
  const routeQs = useHashRouteSearchParams();
  const filters = useMemo(() => deserializeFilters(routeQs.get("fromFilters")), [routeQs]);
  const data = useDistributionAnalyticsData(profile, filters);
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const act = actx.enabled ? managementPlane.mergedState : actx.state;
  const shMap = act.tradePointShowcaseActualizationById;

  if (!product) return <NotFound />;

  const portalType = inferShowcasePortalTypeFromCatalogProduct(product);
  if (portalType !== "entrance" && portalType !== "interior" && portalType !== "hardware") {
    return <NotFound />;
  }
  const modelType = portalType as EquipmentTypeKey;

  const metrics = data.tradePointRows.map((x) => x.metrics);
  const coverage = computeModelCoverage(modelId, modelType, metrics, shMap);
  const coverageTop150 = computeModelCoverage(
    modelId,
    modelType,
    data.tradePointRows.filter((x) => x.row.clientCategory === "top150").map((x) => x.metrics),
    shMap,
  );
  const coverageTop350 = computeModelCoverage(
    modelId,
    modelType,
    data.tradePointRows.filter((x) => x.row.clientCategory === "top350").map((x) => x.metrics),
    shMap,
  );

  const presentRows = data.tradePointRows
    .filter((item) => shMap[item.row.tradePointId]?.selectedShowcaseModels?.some((m) => m.productId === modelId))
    .map((item) => ({
      row: item.row,
      selectedAt: shMap[item.row.tradePointId]?.selectedShowcaseModels?.find((m) => m.productId === modelId)?.selectedAt,
    }));

  const gapRows = buildModelGapTradePoints(modelId, modelType, data.tradePointRows, shMap);

  const cityMap = new Map<string, AnalyticsTradePointRow[]>();
  for (const item of data.tradePointRows) {
    const city = item.row.city || "—";
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(item);
  }
  const cityRows = Array.from(cityMap.entries()).map(([city, items]) => {
    const cityMetrics = items.map((x) => x.metrics);
    const cov = computeModelCoverage(modelId, modelType, cityMetrics, shMap);
    return {
      city,
      eligible: cov.eligibleTradePoints,
      present: cov.presentTradePoints,
      coveragePercent: cov.coveragePercent,
      tradePointNames: items.filter((i) => presentRows.some((p) => p.row.tradePointId === i.row.tradePointId)).map((i) => i.row.tradePointName),
    };
  });

  const citiesWithModel = new Set(presentRows.map((p) => p.row.city));

  const competitorRows = data.tradePointRows
    .filter((item) => !presentRows.some((p) => p.row.tradePointId === item.row.tradePointId))
    .map((item) => {
      const sh = shMap[item.row.tradePointId];
      if (!sh) return null;
      const hasCompetitor = (sh.competitorPortals != null && sh.competitorPortals > 0) || Boolean(sh.competitorsListed?.trim());
      if (!hasCompetitor) return null;
      return {
        city: item.row.city,
        tradePointName: item.row.tradePointName,
        competitorsListed: sh.competitorsListed,
        competitorPortals: sh.competitorPortals,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const backHref = buildHashPath("/distribution", {
    view: "analytics",
    tab: "product",
    f: routeQs.get("fromFilters") || undefined,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4" data-testid="page-model-card">
      <Button asChild variant="ghost" size="sm" className="h-8 px-2">
        <Link href={backHref}>← Назад к дистрибуции</Link>
      </Button>
      <ModelCardHeader product={product} />
      <ModelCardKpiTiles
        coverage={coverage}
        coverageTop150={coverageTop150}
        coverageTop350={coverageTop350}
        citiesCount={citiesWithModel.size}
      />
      <ModelCardCitiesTable rows={cityRows} />
      <ModelCardTradePointsTable rows={presentRows} />
      <ModelCardGapTradePointsTable rows={gapRows} />
      <ModelCardCompetitorsSection rows={competitorRows} />
    </div>
  );
}
