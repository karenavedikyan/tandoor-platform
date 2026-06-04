import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DistributionDashboardSummary } from "@/components/distribution/distribution-dashboard-summary";
import { DistributionCityTab } from "@/components/distribution/distribution-city-tab";
import { DistributionTrendTab } from "@/components/distribution/distribution-trend-tab";
import { DistributionClientTab } from "@/components/distribution/distribution-client-tab";
import { DistributionProductTab } from "@/components/distribution/distribution-product-tab";
import { DistributionTradePointTab } from "@/components/distribution/distribution-tradepoint-tab";
import { DistributionManagerTab } from "@/components/distribution/distribution-manager-tab";
import { DistributionEntryWizard } from "@/components/distribution/distribution-entry-wizard";
import { DistributionFiltersBar } from "@/components/distribution/distribution-filters-bar";
import { DistributionTree } from "@/components/distribution/distribution-tree";
import type { DistributionScope } from "@/lib/distribution-tree-data";
import {
  defaultDistributionFilterState,
  extractCityOptions,
  extractRegionOptions,
  filterScopeDealers,
  type DistributionFilterState,
} from "@/lib/distribution-filters";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useMyClientCodes } from "@/hooks/use-my-client-codes";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";

type DistributionMode = "view" | "entry";

export default function DistributionPage() {
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const [mode, setMode] = useState<DistributionMode>("entry");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<DistributionFilterState>(defaultDistributionFilterState);

  const { user } = useCurrentUser();
  const isRealUser = Boolean(user?.id);
  const myCodesQ = useMyClientCodes({ enabled: isRealUser });
  const orgSnapQ = useOrgSnapshot({ enabled: isRealUser });

  const responsibleByCode = useMemo(() => {
    const map = myCodesQ.data?.responsibleByCode;
    if (!map || Object.keys(map).length === 0) return undefined;
    return map;
  }, [myCodesQ.data]);

  const managerLabelByUserId = useMemo(() => {
    const users = orgSnapQ.data?.users ?? [];
    const m = new Map<string, string>();
    for (const u of users) {
      const name = u.fullName?.trim();
      if (u.id && name) m.set(u.id, name);
    }
    return m;
  }, [orgSnapQ.data]);


  const workingDealerRows = useMemo(
    () =>
      actx.enabled
        ? buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, {
            includeArchivedDealers: false,
          })
        : DEALER_BASE_ROWS,
    [actx.enabled, managementPlane.mergedState, profile],
  );

  const scoped = useMemo(() => roleScopedDealerRows(workingDealerRows, profile), [workingDealerRows, profile]);

  const filteredDealers = useMemo(
    () => filterScopeDealers(scoped, filter),
    [scoped, filter],
  );

  const viewScope: DistributionScope = useMemo(
    () => ({ kind: "global", dealers: filteredDealers }),
    [filteredDealers],
  );

  const regionOptions = useMemo(() => extractRegionOptions(scoped), [scoped]);
  const cityOptions = useMemo(() => extractCityOptions(scoped), [scoped]);

  const actualizationLoading =
    (actx.enabled && actx.loading) ||
    (actx.enabled && shouldUseTeamMergedActualizationPlane(profile) && managementPlane.teamFetchLoading);

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-6"
      data-testid="page-distribution"
    >
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-8">
        <div
          className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary"
          aria-hidden
        />
        <div className="relative flex min-w-0 flex-col gap-3 pl-3 sm:flex-row sm:items-start sm:justify-between sm:pl-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">Дистрибуция</h1>
            <p className="mt-1 hidden text-sm text-muted-foreground sm:block sm:text-base">
              Сквозной просмотр витрин по клиентам и точкам в реальном времени.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0" data-testid="link-distribution-matrix-catalog">
            <Link href="/distribution/matrix-catalog">Справочник матриц</Link>
          </Button>
        </div>
      </header>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as DistributionMode)}
        className="w-full min-w-0 space-y-4"
      >
        <TabsList
          data-testid="tabs-distribution-mode"
          className="grid h-auto w-full min-w-0 max-w-md grid-cols-2 gap-1 bg-muted/50 p-1"
        >
          <TabsTrigger value="entry" className="min-h-10 text-xs sm:text-sm" data-testid="tab-distribution-entry">
            Ввод
          </TabsTrigger>
          <TabsTrigger value="view" className="min-h-10 text-xs sm:text-sm" data-testid="tab-distribution-view">
            Аналитика
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="mt-0 min-w-0 space-y-4 focus-visible:ring-0">
          {actualizationLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка актуализации…</p>
          ) : null}

          <DistributionFiltersBar
            value={filter}
            onChange={setFilter}
            regionOptions={regionOptions}
            cityOptions={cityOptions}
          />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <DistributionDashboardSummary scope={viewScope} filter={filter} />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 self-start"
              data-testid="btn-distribution-export-excel"
              onClick={() => {
                void (async () => {
                  const XLSX = await import("xlsx");
                  const { buildDistributionWorkbook, distributionExportFileName } = await import(
                    "@/lib/distribution-excel-export"
                  );
                  const wb = buildDistributionWorkbook({
                    scope: viewScope,
                    filter,
                    managerOptions: {
                      responsibleByCode,
                      managerLabelByUserId,
                    },
                  });
                  XLSX.writeFile(wb, distributionExportFileName(viewScope));
                })();
              }}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Экспорт в Excel
            </Button>
          </div>

          <Tabs defaultValue="manager" className="w-full min-w-0 space-y-3" data-testid="tabs-distribution-view-breakdown">
            <TabsList className="h-auto w-full max-w-lg justify-start gap-1 bg-muted/50 p-1">
              <TabsTrigger value="manager" className="min-h-9 text-xs sm:text-sm" data-testid="tab-distribution-breakdown-manager">
                Менеджер
              </TabsTrigger>
              <TabsTrigger value="client" className="min-h-9 text-xs sm:text-sm" data-testid="tab-distribution-breakdown-client">
                Клиент
              </TabsTrigger>
              <TabsTrigger value="tradePoint" className="min-h-9 text-xs sm:text-sm" data-testid="tab-distribution-breakdown-tradepoint">
                ТТ
              </TabsTrigger>
              <TabsTrigger value="product" className="min-h-9 text-xs sm:text-sm" data-testid="tab-distribution-breakdown-product">
                Продукт
              </TabsTrigger>
              <TabsTrigger value="city" className="min-h-9 text-xs sm:text-sm" data-testid="tab-distribution-breakdown-city">
                Город
              </TabsTrigger>
              <TabsTrigger value="trend" className="min-h-9 text-xs sm:text-sm" data-testid="tab-distribution-breakdown-trend">
                Динамика
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manager" className="mt-0 focus-visible:ring-0">
              <DistributionManagerTab
                scope={viewScope}
                filter={filter}
                responsibleByCode={responsibleByCode}
                managerLabelByUserId={managerLabelByUserId}
              />
            </TabsContent>
            <TabsContent value="client" className="mt-0 focus-visible:ring-0">
              <DistributionClientTab scope={viewScope} filter={filter} profile={profile} />
            </TabsContent>
            <TabsContent value="tradePoint" className="mt-0 focus-visible:ring-0">
              <DistributionTradePointTab scope={viewScope} filter={filter} profile={profile} />
            </TabsContent>
            <TabsContent value="product" className="mt-0 focus-visible:ring-0">
              <DistributionProductTab scope={viewScope} filter={filter} profile={profile} />
            </TabsContent>
            <TabsContent value="city" className="mt-0 focus-visible:ring-0">
              <DistributionCityTab scope={viewScope} filter={filter} profile={profile} />
            </TabsContent>
            <TabsContent value="trend" className="mt-0 focus-visible:ring-0">
              <DistributionTrendTab scope={viewScope} filter={filter} />
            </TabsContent>
          </Tabs>

          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по клиенту или торговой точке"
              className="pl-9"
              data-testid="input-distribution-search"
            />
          </div>

          {!actualizationLoading && filteredDealers.length === 0 ? (
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardContent className="px-3 py-6 sm:px-4">
                <p className="text-sm text-muted-foreground">
                  {scoped.length === 0
                    ? "В вашей зоне видимости пока нет клиентов."
                    : "Нет клиентов по выбранным фильтрам."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <DistributionTree
                scope={viewScope}
                profile={profile}
                searchQuery={searchQuery}
                actualizationLoading={actualizationLoading}
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="entry" className="mt-0 min-w-0 focus-visible:ring-0">
          <DistributionEntryWizard profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
