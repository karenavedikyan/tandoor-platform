import { useCallback, useEffect, useMemo, useRef } from "react";
import { DistributionTradePointMatrixEntry } from "@/components/distribution/distribution-tradepoint-matrix-entry";
import { build1cDealerRow, build1cPoint, type OneCLegalShapeInput } from "@/lib/one-c-dealer-shape";
import { triggerDistributionExportTo1cFireAndForget } from "@/lib/one-c-distribution-export";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { setShowcaseMatrixApiBase, resetShowcaseMatrixApiBase } from "@/lib/showcase-matrix-api";
import { refreshMatrixFromServer, SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import { SHOWCASE_MATRIX_CHANGED_EVENT } from "@/lib/trade-point-showcase-matrix-storage";
import type { OneCStoreDetailWithDistribution } from "@/lib/one-c-showroom-api";
import { useToast } from "@/hooks/use-toast";

export type OneCStoreDistributionEntryProps = {
  storeId1c: string;
  store: OneCStoreDetailWithDistribution;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorName: string;
  matrixSectionTitle?: string;
};

function legalFromStoreDetail(store: OneCStoreDetailWithDistribution): OneCLegalShapeInput | null {
  if (!store.legal_entity_1c) return null;
  return {
    id_1c: store.legal_entity_1c,
    name: store.legal_name?.trim() || store.legal_legal_name?.trim() || "Клиент 1С",
    legal_name: store.legal_legal_name ?? store.legal_name,
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
}

export function OneCStoreDistributionEntry({
  storeId1c,
  store,
  profile,
  actorUserId,
  actorName,
  matrixSectionTitle = "Контрагент и витрина",
}: OneCStoreDistributionEntryProps) {
  const { toast } = useToast();
  const exportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dealerPoint = useMemo(() => {
    const legal = legalFromStoreDetail(store);
    if (!legal) return null;
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
    setShowcaseMatrixApiBase("/api/one-c/showcase-matrix");
    return () => resetShowcaseMatrixApiBase();
  }, []);

  useEffect(() => {
    if (!dealerPoint) return;
    void refreshMatrixFromServer(dealerPoint.point.id, dealerPoint.dealer.id);
  }, [dealerPoint]);

  const scheduleExport = useCallback(() => {
    if (exportDebounceRef.current) clearTimeout(exportDebounceRef.current);
    exportDebounceRef.current = setTimeout(() => {
      triggerDistributionExportTo1cFireAndForget((result) => {
        toast({
          title: result.ok ? "Отправлено в 1С" : "Ошибка отправки в 1С",
          description: result.ok ? undefined : result.message,
          variant: result.ok ? "default" : "destructive",
        });
      });
    }, 800);
  }, [toast]);

  useEffect(() => {
    if (!store.canEditDistribution) return;
    const onMatrixChanged = () => scheduleExport();
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, onMatrixChanged);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onMatrixChanged);
    return () => {
      window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, onMatrixChanged);
      window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onMatrixChanged);
      if (exportDebounceRef.current) clearTimeout(exportDebounceRef.current);
    };
  }, [scheduleExport, store.canEditDistribution]);

  if (!dealerPoint) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="one-c-store-distribution-missing-legal">
        Нет данных юрлица для внесения дистрибуции.
      </p>
    );
  }

  return (
    <div data-testid="one-c-store-distribution-entry" data-store-id-1c={storeId1c}>
      <DistributionTradePointMatrixEntry
        dealer={dealerPoint.dealer}
        point={dealerPoint.point}
        profile={profile}
        actorUserId={actorUserId}
        actorName={actorName}
        hideOpenTasksSection
        hideOpenTradePointCard
        hideDistributionOnPointSection
        hideCounterpartyStickyHeader
        matrixSectionTitle={matrixSectionTitle}
      />
    </div>
  );
}
