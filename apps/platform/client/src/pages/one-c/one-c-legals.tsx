import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCLegals } from "@/lib/one-c-showroom-api";
import {
  ONE_C_PAGE_LIMIT,
  OneCLoadingBlock,
  OneCPagination,
  OneCOnlyActiveToggle,
  OneCPageShell,
  OneCRefreshStubButton,
  OneCSearchInput,
  useDebouncedSearch,
} from "./one-c-ui";
import { OneCLegalsCardsList } from "./one-c-legals-cards";
import { OneCLegalsTable } from "./one-c-legals-table";
import { OneCListDensityToggle } from "./one-c-list-density-toggle";
import { OneCListKpi } from "./one-c-list-kpi";
import { buildOneCLegalsKpi } from "./one-c-list-kpi-data";
import { useOneCListDensity } from "./use-one-c-list-density";

export default function OneCLegalsPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const actx = useClientBaseActualization();
  const act = actx.state;
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [onlyActive, setOnlyActive] = useState(true);
  const [hasDistribution, setHasDistribution] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchOneCLegals>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { density, setDensity, effectiveDensity } = useOneCListDensity("legals", "grid");

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, onlyActive, hasDistribution]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCLegals({ q: debouncedQ, limit: ONE_C_PAGE_LIMIT, offset, onlyActive, hasDistribution })
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить юрлица.");
          return;
        }
        setItems(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAccess, debouncedQ, offset, onlyActive, hasDistribution]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;

  return (
    <OneCPageShell
      path="/1c/legals"
      title="Юрлица"
      subtitle={`${total.toLocaleString("ru-RU")} записей из выгрузки 1С`}
      testId="page-one-c-legals"
      actions={<OneCRefreshStubButton />}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OneCListKpi items={buildOneCLegalsKpi(items, total, onlyActive)} testId="kpi-one-c-legals" />
        <OneCListDensityToggle value={density} onChange={setDensity} testIdPrefix="one-c-legals" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OneCSearchInput
          value={searchQ}
          onChange={setSearchQ}
          placeholder="Название, полное наименование, ИНН, холдинг…"
          testId="input-one-c-legals-search"
        />
        <OneCOnlyActiveToggle
          checked={onlyActive}
          onCheckedChange={setOnlyActive}
          testId="toggle-one-c-legals-only-active"
        />
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="toggle-one-c-legals-has-distribution"
            checked={hasDistribution}
            onChange={(e) => setHasDistribution(e.target.checked)}
            data-testid="toggle-one-c-legals-has-distribution"
          />
          <label htmlFor="toggle-one-c-legals-has-distribution" className="text-sm">
            Только с дистрибуцией
          </label>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : (
        <>
          {effectiveDensity === "table" ? (
            <OneCLegalsTable items={items} testIdPrefix="one-c-legals" />
          ) : (
            <OneCLegalsCardsList items={items} density={effectiveDensity} act={act} testIdPrefix="one-c-legals" />
          )}
          <OneCPagination
            total={total}
            limit={ONE_C_PAGE_LIMIT}
            offset={offset}
            onOffsetChange={setOffset}
            testIdPrefix="one-c-legals"
          />
        </>
      )}
    </OneCPageShell>
  );
}
