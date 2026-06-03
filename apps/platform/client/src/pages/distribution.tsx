import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DistributionTree } from "@/components/distribution/distribution-tree";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";

export default function DistributionPage() {
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const [searchQuery, setSearchQuery] = useState("");

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

  const actualizationLoading =
    (actx.enabled && actx.loading) ||
    (actx.enabled && shouldUseTeamMergedActualizationPlane(profile) && managementPlane.teamFetchLoading);

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6"
      data-testid="page-distribution"
    >
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <div
          className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary"
          aria-hidden
        />
        <div className="relative flex min-w-0 flex-col gap-3 pl-3 sm:flex-row sm:items-start sm:justify-between sm:pl-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Дистрибуция</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Сквозной просмотр витрин по клиентам и точкам в реальном времени.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0" data-testid="link-distribution-matrix-catalog">
            <Link href="/distribution/matrix-catalog">Справочник матриц</Link>
          </Button>
        </div>
      </header>

      {actualizationLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка актуализации…</p>
      ) : null}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по клиенту или торговой точке"
          className="pl-9"
          data-testid="input-distribution-search"
        />
      </div>

      {!actualizationLoading && scoped.length === 0 ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="px-3 py-6 sm:px-4">
            <p className="text-sm text-muted-foreground">В вашей зоне видимости пока нет клиентов.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <DistributionTree
            scope={{ kind: "global", dealers: scoped }}
            profile={profile}
            searchQuery={searchQuery}
            actualizationLoading={actualizationLoading}
          />
        </Card>
      )}
    </div>
  );
}
