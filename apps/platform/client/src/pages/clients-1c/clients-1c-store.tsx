import { useEffect, useMemo, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canAccessClients1cForUser } from "@/lib/auth-access";
import {
  clients1cOrderToBitrixListItem,
  fetchClients1cStore,
  type Clients1cStoreResponse,
} from "@/lib/clients-1c-api";
import { build1cDealerRow, build1cPoint } from "@/lib/one-c-dealer-shape";
import { setShowcaseMatrixApiBase, resetShowcaseMatrixApiBase } from "@/lib/showcase-matrix-api";
import { refreshMatrixFromServer } from "@/lib/showcase-matrix-store";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import {
  OneCLoadingBlock,
  OneCPageShell,
  OneCDetailSection,
  OneCInfoBlock,
  dash,
} from "@/pages/one-c/one-c-ui";
import { Badge } from "@/components/ui/badge";
import { DistributionCardHeaderBlock } from "@/components/distribution/distribution-card-header-block";
import { DistributionTradePointMatrixEntry } from "@/components/distribution/distribution-tradepoint-matrix-entry";
import { OneCOrdersTable } from "@/pages/one-c/one-c-orders-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clients1cRefreshButton } from "./clients-1c-refresh-button";

function SourceBadge({ source }: { source: string }) {
  if (source === "override_1c") {
    return <Badge variant="secondary" className="text-[10px]">1С</Badge>;
  }
  if (source === "matrix_lk") {
    return <Badge variant="outline" className="text-[10px]">ЛК</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">{source}</Badge>;
}

export default function Clients1cStorePage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const actx = useClientBaseActualization();
  const [, params] = useRoute("/clients-1c/:holdingId/tp/:storeId");
  const holdingId = params?.holdingId ?? "";
  const storeId = params?.storeId ?? "";
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Clients1cStoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessClients1cForUser(user.role) : false;

  useEffect(() => {
    setShowcaseMatrixApiBase("/api/one-c/showcase-matrix");
    return () => resetShowcaseMatrixApiBase();
  }, []);

  useEffect(() => {
    if (!canAccess || !holdingId || !storeId) return;
    let cancelled = false;
    setLoading(true);
    void fetchClients1cStore(holdingId, storeId)
      .then((storeRes) => {
        if (cancelled) return;
        if (!("ok" in storeRes) || !storeRes.ok) {
          setError("message" in storeRes ? storeRes.message ?? "ТТ не найдена." : "Ошибка");
          setData(null);
          return;
        }
        setData(storeRes);
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
  }, [canAccess, holdingId, storeId, reloadKey]);

  const dealerPoint = useMemo(() => {
    const store = data?.store;
    if (!store) return null;
    const legal = {
      id_1c: store.legal_id_1c,
      name: store.legal_name ?? store.holding_name ?? "",
      legal_name: store.legal_name,
      inn: store.legal_inn,
      kpp: null,
      ogrn: null,
      region: store.legal_region,
      city: store.legal_city,
      client_type: null,
      payment_form: null,
      phone: null,
      email: null,
      discount_code: null,
      discount_percent: null,
      responsible_manager_name: store.responsible_manager_name,
      regional_manager_name: store.regional_manager_name,
      plan_sum: null,
      plan_retro_bonus: null,
    };
    const dealer = build1cDealerRow(legal, { canEditDistribution: true });
    const point = build1cPoint(
      {
        id_1c: store.store_id_1c,
        address: store.store_address,
        name: store.store_name,
        manager_name: store.store_manager_name,
        manager_phone: null,
        legal_entity_1c: store.legal_id_1c,
      },
      legal,
    );
    return { dealer, point };
  }, [data?.store]);

  useEffect(() => {
    if (!dealerPoint) return;
    void refreshMatrixFromServer(dealerPoint.point.id, dealerPoint.dealer.id);
  }, [dealerPoint]);

  const ordersForTable = useMemo(
    () => (data?.orders ?? []).map(clients1cOrderToBitrixListItem),
    [data?.orders],
  );

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!holdingId || !storeId) return <Redirect to="/clients-1c" />;

  const store = data?.store;

  return (
    <OneCPageShell
      path={`/clients-1c/${holdingId}/tp/${storeId}`}
      breadcrumbLabels={{
        holding: store?.holding_name ?? "Клиент",
        tradePoint: store?.store_name ?? "ТТ",
      }}
      title={store?.store_name ?? "Торговая точка"}
      subtitle={
        store
          ? [
              dash(store.store_address),
              store.legal_name ? `ЮЛ: ${store.legal_name}` : null,
              store.refreshed_at ? `обновлено ${formatDisplayDateTime(store.refreshed_at)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      testId="page-clients-1c-store"
      actions={<Clients1cRefreshButton onRefreshed={() => setReloadKey((k) => k + 1)} />}
    >
      <p className="text-sm">
        <Link href={`/clients-1c/${holdingId}`} className="text-primary hover:underline">
          ← К карточке клиента
        </Link>
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : !store ? (
        <p className="text-muted-foreground">Торговая точка не найдена</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OneCInfoBlock label="Статус" testId="info-clients-1c-store-status">
              {dash(store.store_status)}
            </OneCInfoBlock>
            <OneCInfoBlock label="Менеджер ТТ" testId="info-clients-1c-store-mgr">
              {dash(store.store_manager_name)}
            </OneCInfoBlock>
            <OneCInfoBlock label="Ответственный" testId="info-clients-1c-resp-mgr">
              {dash(store.responsible_manager_name)}
            </OneCInfoBlock>
            <OneCInfoBlock label="Регионал" testId="info-clients-1c-reg-mgr">
              {dash(store.regional_manager_name)}
            </OneCInfoBlock>
          </div>

          {dealerPoint ? (
            <OneCDetailSection title="Дистрибуция" testId="section-clients-1c-distribution-form">
              <DistributionCardHeaderBlock externalKeys={[storeId]} />
              <DistributionTradePointMatrixEntry
                dealer={dealerPoint.dealer}
                point={dealerPoint.point}
                act={actx.state}
                hideOpenTasksSection
                hideOpenTradePointCard
                hideDistributionOnPointSection
                hidePlacementBlocksSection
                hideCounterpartyStickyHeader
              />
            </OneCDetailSection>
          ) : null}

          <OneCDetailSection title="Строки дистрибуции (источник)" testId="section-clients-1c-distribution-rows">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип</TableHead>
                    <TableHead>Цель</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Факт</TableHead>
                    <TableHead>Источник</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.distribution ?? []).map((row) => (
                    <TableRow key={`${row.target_kind}-${row.target_id}`}>
                      <TableCell>{row.target_kind}</TableCell>
                      <TableCell className="font-mono text-xs">{row.target_id}</TableCell>
                      <TableCell>{dash(row.status)}</TableCell>
                      <TableCell className="tabular-nums">{row.placement_actual ?? "—"}</TableCell>
                      <TableCell>
                        <SourceBadge source={row.source} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </OneCDetailSection>

          <OneCDetailSection title="Заказы за 90 дней" testId="section-clients-1c-orders">
            <OneCOrdersTable
              orders={ordersForTable}
              showStoreColumn={false}
              showLegalColumn={false}
              emptyLabel="Заказов за 90 дней нет"
              testIdPrefix="clients-1c-store"
            />
          </OneCDetailSection>

          <OneCDetailSection title="История изменений дистрибуции" testId="section-clients-1c-history">
            <ul className="space-y-2" data-testid="list-clients-1c-store-history">
              {(data?.history ?? []).map((h) => (
                <li key={h.id} className="rounded-md border px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{h.action}</span>
                    <span className="text-muted-foreground">{formatDisplayDateTime(h.createdAt)}</span>
                  </div>
                  <p className="text-muted-foreground">{h.actorFullName ?? "—"}</p>
                </li>
              ))}
              {(data?.history ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">История пуста</li>
              ) : null}
            </ul>
          </OneCDetailSection>
        </>
      )}
    </OneCPageShell>
  );
}
