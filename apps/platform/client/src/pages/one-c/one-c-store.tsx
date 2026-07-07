import { useEffect, useMemo, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { Copy } from "lucide-react";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCStore } from "@/lib/one-c-showroom-api";
import { build1cDealerRow, build1cPoint } from "@/lib/one-c-dealer-shape";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { setShowcaseMatrixApiBase, resetShowcaseMatrixApiBase } from "@/lib/showcase-matrix-api";
import { refreshMatrixFromServer } from "@/lib/showcase-matrix-store";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DistributionTradePointMatrixEntry } from "@/components/distribution/distribution-tradepoint-matrix-entry";
import {
  CopyField,
  dash,
  formatDiscount,
  formatPlanSum,
  OneCDetailSection,
  OneCFieldRow,
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

export default function OneCStorePage() {
  const { toast } = useToast();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { profile } = useReleaseDemoProfile();
  const [, params] = useRoute("/1c/store/:id");
  const storeId = params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<Awaited<ReturnType<typeof fetchOneCStore>>["store"] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <OneCDetailSection title="Команда по этой точке" testId="section-one-c-store-team">
            <OneCFieldRow label="Ответственный менеджер">
              <LkPersonLink
                userId={store.responsible_manager_user_id}
                name={store.legal_responsible_manager_name}
                hrefPrefix="/1c/manager"
              />
            </OneCFieldRow>
            <OneCFieldRow label="Региональный менеджер">
              <LkPersonLink
                userId={store.regional_manager_user_id}
                name={store.legal_regional_manager_name}
                hrefPrefix="/1c/rm"
              />
            </OneCFieldRow>
            <OneCFieldRow label="РОП">
              <LkPersonLink userId={store.rop_user_id} name={store.rop_name} hrefPrefix="/1c/rop" />
            </OneCFieldRow>
          </OneCDetailSection>

          <OneCDetailSection title="Клиент" testId="section-one-c-store-legal">
            <div className="mb-2">
              {store.legal_entity_1c ? (
                <Link
                  href={`/1c/legal/${store.legal_entity_1c}`}
                  className="text-sm text-primary hover:underline"
                >
                  Открыть карточку клиента
                </Link>
              ) : null}
            </div>
            <OneCFieldRow label="Краткое имя">{dash(store.legal_name)}</OneCFieldRow>
            <OneCFieldRow label="Полное наименование">{dash(store.legal_legal_name)}</OneCFieldRow>
            <OneCFieldRow label="ИНН">
              <CopyField value={store.legal_inn} label="ИНН" />
            </OneCFieldRow>
            <OneCFieldRow label="КПП">
              <CopyField value={store.legal_kpp} label="КПП" />
            </OneCFieldRow>
            <OneCFieldRow label="ОГРН">
              <CopyField value={store.legal_ogrn} label="ОГРН" />
            </OneCFieldRow>
            <OneCFieldRow label="Регион · Город">
              {[store.legal_region, store.legal_city].filter(Boolean).join(" · ") || "—"}
            </OneCFieldRow>
            <OneCFieldRow label="Тип клиента · Оплата">
              {[store.legal_client_type, store.legal_payment_form].filter(Boolean).join(" · ") || "—"}
            </OneCFieldRow>
            <OneCFieldRow label="Скидка">
              {formatDiscount(store.legal_discount_code, store.legal_discount_percent)}
            </OneCFieldRow>
            <OneCFieldRow label="Телефон · Email">
              {[store.legal_phone, store.legal_email].filter(Boolean).join(" · ") || "—"}
            </OneCFieldRow>
            <OneCFieldRow label="Номер MA">{dash(store.legal_ma_number)}</OneCFieldRow>
            <OneCFieldRow label="План">
              {formatPlanSum(store.legal_plan_sum)} / retro {dash(store.legal_plan_retro_bonus)}
            </OneCFieldRow>
            {store.legal_parent_1c ? (
              <OneCFieldRow label="Холдинг">
                <Link href={`/1c/legal/${store.legal_parent_1c}`} className="text-primary hover:underline">
                  {dash(store.legal_parent_name)}
                </Link>
              </OneCFieldRow>
            ) : null}
          </OneCDetailSection>

          <section data-testid="section-one-c-distribution-lk">
            <DistributionTradePointMatrixEntry
              dealer={dealerPoint.dealer}
              point={dealerPoint.point}
              profile={profile}
              actorUserId={actorUserId}
              actorName={actorName}
            />
          </section>
        </div>
      ) : null}
    </OneCPageShell>
  );
}
