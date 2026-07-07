import { useEffect, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCStore } from "@/lib/one-c-showroom-api";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { Badge } from "@/components/ui/badge";
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

export default function OneCStorePage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/1c/store/:id");
  const storeId = params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<Awaited<ReturnType<typeof fetchOneCStore>>["store"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

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

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!storeId) return <Redirect to="/1c/stores" />;

  return (
    <OneCPageShell
      path={`/1c/store/${storeId}`}
      breadcrumbLabels={{ tradePoint: dash(store?.address) }}
      title={dash(store?.address)}
      subtitle={
        store ? (
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{dash(store.status)}</Badge>
            <span>импорт: {formatDisplayDateTime(store.imported_at)}</span>
          </span>
        ) : undefined
      }
      testId="page-one-c-store"
      actions={<OneCRefreshStubButton />}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : store ? (
        <div className="space-y-4">
          <OneCDetailSection title="Менеджер" testId="section-one-c-store-manager">
            <OneCFieldRow label="ФИО">
              {store.manager_1c ? (
                <Link href={`/1c/manager/${store.manager_1c}`} className="text-primary hover:underline">
                  {dash(store.manager_name)}
                </Link>
              ) : (
                dash(store.manager_name)
              )}
            </OneCFieldRow>
            <OneCFieldRow label="Телефон">{dash(store.manager_phone)}</OneCFieldRow>
          </OneCDetailSection>

          <OneCDetailSection title="Юрлицо" testId="section-one-c-store-legal">
            <OneCFieldRow label="Краткое имя">
              {store.legal_entity_1c ? (
                <Link href={`/1c/legal/${store.legal_entity_1c}`} className="text-primary hover:underline">
                  {dash(store.legal_name)}
                </Link>
              ) : (
                dash(store.legal_name)
              )}
            </OneCFieldRow>
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
            <OneCFieldRow label="Регион">{dash(store.legal_region)}</OneCFieldRow>
            <OneCFieldRow label="Город">{dash(store.legal_city)}</OneCFieldRow>
            <OneCFieldRow label="Тип клиента">{dash(store.legal_client_type)}</OneCFieldRow>
            <OneCFieldRow label="Форма оплаты">{dash(store.legal_payment_form)}</OneCFieldRow>
            <OneCFieldRow label="Email">{dash(store.legal_email)}</OneCFieldRow>
            <OneCFieldRow label="Телефон">{dash(store.legal_phone)}</OneCFieldRow>
            <OneCFieldRow label="Скидка">
              {formatDiscount(store.legal_discount_code, store.legal_discount_percent)}
            </OneCFieldRow>
            <OneCFieldRow label="Региональный менеджер">{dash(store.legal_regional_manager_name)}</OneCFieldRow>
            <OneCFieldRow label="Ответственный менеджер">{dash(store.legal_responsible_manager_name)}</OneCFieldRow>
            <OneCFieldRow label="Менеджер фурнитуры">
              {store.legal_furniture_manager_name
                ? `${store.legal_furniture_manager_name}${store.legal_furniture_manager_phone ? ` · ${store.legal_furniture_manager_phone}` : ""}`
                : "—"}
            </OneCFieldRow>
            <OneCFieldRow label="Номер MA">{dash(store.legal_ma_number)}</OneCFieldRow>
            <OneCFieldRow label="План (сумма)">{formatPlanSum(store.legal_plan_sum)}</OneCFieldRow>
            <OneCFieldRow label="План (ретро-бонус)">{dash(store.legal_plan_retro_bonus)}</OneCFieldRow>
          </OneCDetailSection>

          {store.legal_parent_1c ? (
            <OneCDetailSection title="Холдинг" testId="section-one-c-store-holding">
              <Link
                href={`/1c/legal/${store.legal_parent_1c}`}
                className="inline-flex flex-wrap items-center gap-2 text-primary hover:underline"
              >
                <span>{dash(store.legal_parent_name)}</span>
                {store.legal_parent_inn ? (
                  <span className="font-mono text-sm text-muted-foreground">{store.legal_parent_inn}</span>
                ) : null}
              </Link>
            </OneCDetailSection>
          ) : null}
        </div>
      ) : null}
    </OneCPageShell>
  );
}
