import { useEffect, useMemo, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { Copy, User } from "lucide-react";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCStore } from "@/lib/one-c-showroom-api";
import { build1cDealerRow, build1cPoint } from "@/lib/one-c-dealer-shape";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { buildHashPath } from "@/lib/hash-route-utils";
import { setShowcaseMatrixApiBase, resetShowcaseMatrixApiBase } from "@/lib/showcase-matrix-api";
import { refreshMatrixFromServer } from "@/lib/showcase-matrix-store";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DistributionCardHeaderBlock } from "@/components/distribution/distribution-card-header-block";
import { DistributionTradePointMatrixEntry } from "@/components/distribution/distribution-tradepoint-matrix-entry";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import {
  CopyField,
  dash,
  formatDiscount,
  formatPlanSum,
  OneCInfoBlock,
  OneCLoadingBlock,
  OneCPageShell,
  OneCRefreshStubButton,
} from "./one-c-ui";

function LkPersonLink({
  userId,
  name,
  phone,
  hrefPrefix,
}: {
  userId: string | null;
  name: string | null;
  phone?: string | null;
  hrefPrefix: "/1c/manager" | "/1c/rm" | "/1c/rop";
}): React.ReactNode {
  if (!name?.trim()) return "—";
  const label = phone?.trim() ? `${name} · ${phone}` : name;
  if (userId) {
    return (
      <Link href={`${hrefPrefix}/${userId}`} className="text-primary hover:underline">
        {label}
      </Link>
    );
  }
  return (
    <span>
      {label} <span className="text-muted-foreground">(нет в ЛК)</span>
    </span>
  );
}

function CopyableText({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}): React.ReactNode {
  const { toast } = useToast();
  const display = dash(value);

  async function onCopy() {
    if (!value?.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      toast({ title: "Скопировано" });
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  }

  if (!value?.trim()) return display;

  return (
    <button
      type="button"
      className={cn(
        "w-full cursor-pointer text-left hover:text-primary",
        className,
      )}
      title="Кликните, чтобы скопировать"
      onClick={() => void onCopy()}
    >
      {display}
    </button>
  );
}

export default function OneCStorePage() {
  const { toast } = useToast();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const [, params] = useRoute("/1c/store/:id");
  const storeId = params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<Awaited<ReturnType<typeof fetchOneCStore>>["store"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoExpanded, setInfoExpanded] = useState(false);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    setShowcaseMatrixApiBase("/api/one-c/showcase-matrix");
    return () => resetShowcaseMatrixApiBase();
  }, []);

  useEffect(() => {
    if (!canAccess || !storeId) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCStore(storeId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Торговая точка не найдена.");
          setStore(null);
          return;
        }
        setStore(res.store);
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
  }, [canAccess, storeId]);

  const dealerPoint = useMemo(() => {
    if (!store || !store.legal_entity_1c) return null;
    const legal = {
      id_1c: store.legal_entity_1c,
      name: store.legal_name ?? "",
      legal_name: store.legal_legal_name,
      inn: store.legal_inn,
      kpp: store.legal_kpp,
      ogrn: store.legal_ogrn,
      region: store.legal_region,
      city: store.legal_city,
      client_type: store.legal_client_type,
      payment_form: store.legal_payment_form,
      phone: store.legal_phone,
      email: store.legal_email,
      discount_code: store.legal_discount_code,
      discount_percent: store.legal_discount_percent,
      responsible_manager_name: store.legal_responsible_manager_name,
      regional_manager_name: store.legal_regional_manager_name,
      plan_sum: store.legal_plan_sum,
      plan_retro_bonus: store.legal_plan_retro_bonus,
    };
    const dealer = build1cDealerRow(legal, { canEditDistribution: store.canEditDistribution });
    const point = build1cPoint(
      {
        id_1c: store.id_1c,
        address: store.address,
        name: store.name,
        manager_name: store.manager_name,
        manager_phone: store.manager_phone,
        legal_entity_1c: store.legal_entity_1c,
      },
      legal,
    );
    return { dealer, point };
  }, [store]);

  useEffect(() => {
    if (!dealerPoint) return;
    void refreshMatrixFromServer(dealerPoint.point.id, dealerPoint.dealer.id);
  }, [dealerPoint]);

  async function copyAddress() {
    if (!store?.address?.trim()) return;
    try {
      await navigator.clipboard.writeText(store.address.trim());
      toast({ title: "Адрес скопирован" });
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  }

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!storeId) return <Redirect to="/1c/stores" />;

  const legalLabel = dash(store?.legal_name);
  const subtitleParts = [
    store?.legal_city,
    store?.name ? `ТТ · ${store.name}` : "ТТ",
    store ? `импортировано ${formatDisplayDateTime(store.imported_at)}` : null,
  ].filter(Boolean);

  const actorUserId = user.id;
  const actorName = displayUserName(user) ?? userLabelFromProfile(profile);

  const regionCity = [store?.legal_region, store?.legal_city].filter(Boolean).join(" · ") || "—";
  const managerName = dash(store?.legal_responsible_manager_name);

  return (
    <OneCPageShell
      path={`/1c/store/${storeId}`}
      breadcrumbLabels={{ legal: legalLabel, tradePoint: dash(store?.address) }}
      title={dash(store?.address)}
      subtitle={
        store ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{subtitleParts.join(" · ")}</span>
            <Badge variant="outline">{dash(store.status)}</Badge>
          </span>
        ) : undefined
      }
      testId="page-one-c-store"
      actions={
        <>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void copyAddress()}>
            <Copy className="h-4 w-4" />
            Копировать адрес
          </Button>
          <OneCRefreshStubButton />
        </>
      }
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : store && dealerPoint ? (
        <div className="space-y-4">
          <div
            className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-card/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
            data-testid="bar-one-c-store-summary"
          >
            <div className="flex max-h-14 flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 max-md:basis-full max-md:justify-between">
                <Badge variant="outline" className="shrink-0">
                  {dash(store.status)}
                </Badge>
                <div className="flex min-w-0 items-center gap-1.5 text-sm">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {store.responsible_manager_user_id ? (
                    <Link
                      href={`/1c/manager/${store.responsible_manager_user_id}`}
                      className="truncate text-primary hover:underline"
                    >
                      {managerName}
                    </Link>
                  ) : (
                    <span className="truncate">{managerName}</span>
                  )}
                </div>
                <span className="hidden text-xs text-muted-foreground md:inline">{regionCity}</span>
              </div>

              <span className="w-full text-xs text-muted-foreground md:hidden">{regionCity}</span>
            </div>
          </div>

          {dealerPoint ? (
            <div className="rounded-lg border border-border/70 bg-card/80 px-3 py-2">
              <DistributionCardHeaderBlock
                externalKeys={[dealerPoint.point.id]}
                act={actx.state}
                testId="one-c-store-header-distribution"
              />
            </div>
          ) : null}

          <section
            data-testid="section-one-c-distribution-lk"
            className="mt-4"
          >
            <DistributionTradePointMatrixEntry
              dealer={dealerPoint.dealer}
              point={dealerPoint.point}
              profile={profile}
              actorUserId={actorUserId}
              actorName={actorName}
              hideOpenTasksSection
              hideOpenTradePointCard
              hideDistributionOnPointSection
              hidePlacementBlocksSection
              hideCounterpartyStickyHeader
              matrixSectionTitle="Контрагент и витрина"
            />
          </section>

          <section data-testid="section-one-c-store-info" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">О точке и клиенте</h2>
              <div className="flex flex-wrap items-center gap-2">
                {store.legal_entity_1c ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={`/1c/legal/${store.legal_entity_1c}`}>Открыть карточку клиента</Link>
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" asChild>
                  <a
                    href={buildHashPath(`/dealers/${dealerPoint.dealer.id}/trade-points/${dealerPoint.point.id}`, {
                      tradePointShowcase: "1",
                    })}
                  >
                    Открыть карточку ТТ
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="button-one-c-store-info-toggle"
                  onClick={() => setInfoExpanded((v) => !v)}
                >
                  {infoExpanded ? "Свернуть" : "Показать всё"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <OneCInfoBlock label="Ответственный менеджер" testId="tile-one-c-responsible-manager">
                <LkPersonLink
                  userId={store.responsible_manager_user_id}
                  name={store.legal_responsible_manager_name}
                  hrefPrefix="/1c/manager"
                />
              </OneCInfoBlock>
              <OneCInfoBlock label="Региональный менеджер" testId="tile-one-c-regional-manager">
                <LkPersonLink
                  userId={store.regional_manager_user_id}
                  name={store.legal_regional_manager_name}
                  hrefPrefix="/1c/rm"
                />
              </OneCInfoBlock>
              <OneCInfoBlock label="РОП" testId="tile-one-c-rop">
                <LkPersonLink userId={store.rop_user_id} name={store.rop_name} hrefPrefix="/1c/rop" />
              </OneCInfoBlock>
              <OneCInfoBlock label="ИНН" testId="tile-one-c-inn">
                <CopyField value={store.legal_inn} label="ИНН" />
              </OneCInfoBlock>
              <OneCInfoBlock label="Тип клиента · Оплата" testId="tile-one-c-client-type">
                {[store.legal_client_type, store.legal_payment_form].filter(Boolean).join(" · ") || "—"}
              </OneCInfoBlock>
              <OneCInfoBlock label="Скидка" testId="tile-one-c-discount">
                <span className="tabular-nums">
                  {formatDiscount(store.legal_discount_code, store.legal_discount_percent)}
                </span>
              </OneCInfoBlock>

              {infoExpanded ? (
                <>
                  <OneCInfoBlock label="Полное наименование" testId="tile-one-c-legal-name">
                    <CopyableText value={store.legal_legal_name} />
                  </OneCInfoBlock>
                  <OneCInfoBlock label="КПП" testId="tile-one-c-kpp">
                    <CopyField value={store.legal_kpp} label="КПП" />
                  </OneCInfoBlock>
                  <OneCInfoBlock label="ОГРН" testId="tile-one-c-ogrn">
                    <CopyField value={store.legal_ogrn} label="ОГРН" />
                  </OneCInfoBlock>
                  <OneCInfoBlock label="Регион · Город" testId="tile-one-c-region-city">
                    {regionCity}
                  </OneCInfoBlock>
                  <OneCInfoBlock label="Телефон · Email" testId="tile-one-c-contacts">
                    {[store.legal_phone, store.legal_email].filter(Boolean).join(" · ") || "—"}
                  </OneCInfoBlock>
                  <OneCInfoBlock label="Номер MA" testId="tile-one-c-ma">
                    <span className="tabular-nums">{dash(store.legal_ma_number)}</span>
                  </OneCInfoBlock>
                  <OneCInfoBlock label="План" testId="tile-one-c-plan">
                    <span className="tabular-nums">
                      {formatPlanSum(store.legal_plan_sum)} / retro {dash(store.legal_plan_retro_bonus)}
                    </span>
                  </OneCInfoBlock>
                  {store.legal_parent_1c ? (
                    <OneCInfoBlock label="Холдинг" testId="tile-one-c-holding">
                      <div className="space-y-1">
                        <CopyableText value={store.legal_parent_name} />
                        <Link
                          href={`/1c/legal/${store.legal_parent_1c}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Открыть карточку холдинга
                        </Link>
                      </div>
                    </OneCInfoBlock>
                  ) : (
                    <OneCInfoBlock label="Холдинг" testId="tile-one-c-holding">
                      —
                    </OneCInfoBlock>
                  )}
                  <OneCInfoBlock label="Мебельный менеджер" testId="tile-one-c-furniture-manager">
                    {store.legal_furniture_manager_name
                      ? [
                          store.legal_furniture_manager_name,
                          store.legal_furniture_manager_phone,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"}
                  </OneCInfoBlock>
                  <OneCInfoBlock label="Последний импорт" testId="tile-one-c-imported-at">
                    {formatDisplayDateTime(store.imported_at)}
                  </OneCInfoBlock>
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </OneCPageShell>
  );
}
