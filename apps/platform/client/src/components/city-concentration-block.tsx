import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CityConcentrationRow } from "@/lib/city-concentration";
import { getCityRiskLevel, safeCityId } from "@/lib/city-concentration";

type CityConcentrationBlockProps = {
  rows: CityConcentrationRow[];
  showAllHref: string;
  variant: "analytics" | "dealer";
  cityHref: (city: string) => string;
  activeHref: (city: string) => string;
  attentionHref: (city: string) => string;
  /** На странице клиентской базы ссылка «все города» часто не нужна. */
  showAllLink?: boolean;
  /** Ссылка на карту клиентов (только вариант analytics). */
  clientMapHref?: string;
};

function CityRows({
  rows,
  variant,
  cityHref,
  activeHref,
  attentionHref,
}: Omit<CityConcentrationBlockProps, "showAllHref" | "showAllLink" | "clientMapHref">) {
  return (
    <ul className="min-w-0 space-y-2">
      {rows.map((row) => {
        const sid = safeCityId(row.city);
        const risk = getCityRiskLevel(row);
        const rowTestId = variant === "analytics" ? `row-analytics-city-${sid}` : `row-dealer-base-city-${sid}`;
        const linkCityTestId = variant === "analytics" ? `link-analytics-city-${sid}` : `link-dealer-base-city-${sid}`;
        const linkActiveTestId = variant === "analytics" ? `link-analytics-city-active-${sid}` : undefined;
        const linkAttentionTestId = variant === "analytics" ? `link-analytics-city-attention-${sid}` : undefined;
        return (
          <li key={row.city} className="min-w-0 rounded-lg border border-border/70 bg-card/60 p-2 sm:p-3" data-testid={rowTestId}>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <a
                  href={cityHref(row.city)}
                  data-testid={linkCityTestId}
                  className="min-w-0 truncate text-sm font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {row.city}
                </a>
                {risk === "critical" ? (
                  <Badge variant="destructive" className="shrink-0 text-[10px] font-semibold">
                    Риск
                  </Badge>
                ) : null}
              </div>
              <div
                className="h-1.5 w-full min-w-0 shrink-0 overflow-hidden rounded-full bg-muted sm:max-w-[120px]"
                title="Концентрация относительно лидера по числу клиентов"
              >
                <div className="h-full rounded-full bg-orange-500/85" style={{ width: `${Math.round(100 * row.intensity)}%` }} />
              </div>
            </div>
            <div className="mt-2 grid min-w-0 grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
              <span>
                Всего: <span className="tabular-nums text-foreground">{row.total}</span>
              </span>
              <a href={activeHref(row.city)} className="underline-offset-2 hover:text-foreground hover:underline" data-testid={linkActiveTestId}>
                Активные: <span className="tabular-nums text-foreground">{row.active}</span> ({row.pctActive}%)
              </a>
              <span>
                TOP: <span className="tabular-nums text-foreground">{row.top}</span>
              </span>
              <a
                href={attentionHref(row.city)}
                className="underline-offset-2 hover:text-foreground hover:underline"
                data-testid={linkAttentionTestId}
              >
                Внимание: <span className="tabular-nums text-foreground">{row.attention}</span> ({row.pctAttention}%)
              </a>
              <span>
                Потенциал: <span className="tabular-nums text-foreground">{row.potential}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CityConcentrationBlock({
  rows,
  showAllHref,
  variant,
  cityHref,
  activeHref,
  attentionHref,
  showAllLink = true,
  clientMapHref,
}: CityConcentrationBlockProps) {
  const empty = (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
      По текущим фильтрам нет городов для отображения.
    </div>
  );

  const inner = (
    <>
      {rows.length === 0 ? empty : (
        <CityRows rows={rows} variant={variant} cityHref={cityHref} activeHref={activeHref} attentionHref={attentionHref} />
      )}
      {showAllLink ? (
        <div className="mt-3 text-center sm:text-left">
          <a href={showAllHref} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
            Показать все города
          </a>
        </div>
      ) : null}
    </>
  );

  if (variant === "analytics") {
    return (
      <Card className="min-w-0 overflow-hidden rounded-xl border border-border/80 shadow-sm" data-testid="card-analytics-city-concentration">
        <CardHeader className="pb-2">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Города и концентрация клиентов</CardTitle>
              <CardDescription>
                Топ‑10 городов по числу клиентов в текущем доступе; «теплота» — доля от лидера по объёму.
              </CardDescription>
            </div>
            {clientMapHref ? (
              <a
                href={clientMapHref}
                className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
                data-testid="link-analytics-open-client-map"
              >
                Открыть карту
              </a>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="min-w-0">{inner}</CardContent>
      </Card>
    );
  }

  return (
    <section className="min-w-0 space-y-3" data-testid="section-dealer-base-cities">
      <div>
        <h3 className="text-base font-semibold text-foreground">Города и концентрация клиентов</h3>
        <p className="text-xs text-muted-foreground">Сводка по городам в выбранных фильтрах; нажмите город или сегмент, чтобы перейти в таблицу.</p>
      </div>
      {inner}
    </section>
  );
}
