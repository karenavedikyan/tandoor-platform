import type { ReactElement } from "react";
import { useCallback, useMemo } from "react";
import { TradePointShowcaseCatalogPanel } from "@/components/trade-point-showcase-catalog-panel";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import {
  mergeActualizationState,
  type TradePointShowcaseActualization,
  type TradePointShowcaseSelectedModel,
  type ShowcaseMatrixTask,
} from "@/lib/client-base-actualization-state";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { resolveShowcaseMatrixClientCategory } from "@/lib/trade-point-showcase-matrix-required";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import type { ClientCategoryId } from "@/lib/client-category";
import { resolveTradePointDisplayName } from "@/lib/trade-point-display-labels";

function emptyShowcase(dealerId: string, tradePointId: string): TradePointShowcaseActualization {
  const iso = new Date().toISOString();
  return {
    tradePointId,
    dealerId,
    hasShowcase: true,
    totalPortals: null,
    entrancePortals: null,
    interiorPortals: null,
    hardwareSections: null,
    showcaseAreaSqm: null,
    showcaseComment: "",
    tandoorTotalPortals: null,
    tandoorEntrancePortals: null,
    tandoorInteriorPortals: null,
    competitorPortals: null,
    competitorsListed: "",
    fillingComment: "",
    hasExpansionPotential: null,
    additionalPortalsPotential: null,
    showcasePriority: "",
    firstPriorityNeed: "",
    rmRopComment: "",
    updatedAt: iso,
    updatedBy: "",
    updatedByName: "",
  };
}

export type TradePointShowcaseCatalogSlotProps = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorLabel: string;
  canEdit: boolean;
};

export function TradePointShowcaseCatalogSlot({
  dealer,
  point,
  profile,
  actorUserId,
  actorLabel,
  canEdit,
}: TradePointShowcaseCatalogSlotProps): ReactElement {
  const actx = useClientBaseActualization();
  const showcaseRec = actx.state.tradePointShowcaseActualizationById[point.id];
  const tradePointDisplayName = useMemo(() => resolveTradePointDisplayName(dealer, point), [dealer, point]);

  const matrixClientCategory = useMemo((): ClientCategoryId | null => {
    const fields = {
      ...((actx.state.manuallyCreatedDealersById[dealer.id]?.fields ?? {}) as Record<string, unknown>),
      ...((actx.state.dealerOverridesById[dealer.id]?.fields ?? {}) as Record<string, unknown>),
    };
    return resolveShowcaseMatrixClientCategory(dealer.clientCategory, fields);
  }, [actx.state, dealer.clientCategory, dealer.id]);

  const persistShowcase = useCallback(
    async (mutate: (prev: TradePointShowcaseActualization) => TradePointShowcaseActualization) => {
      const iso = new Date().toISOString();
      const uid = profile.personaUserId;
      const uname = userLabelFromProfile(profile);
      await actx.persist((prev) => {
        const prevRec = prev.tradePointShowcaseActualizationById[point.id] ?? emptyShowcase(dealer.id, point.id);
        const nextRec = mutate({
          ...prevRec,
          updatedAt: iso,
          updatedBy: uid,
          updatedByName: uname,
        });
        return mergeActualizationState(prev, {
          tradePointShowcaseActualizationById: {
            ...prev.tradePointShowcaseActualizationById,
            [point.id]: nextRec,
          },
        });
      });
    },
    [actx, dealer.id, point.id, profile],
  );

  const onChangeSelected = useCallback(
    (next: TradePointShowcaseSelectedModel[]) => {
      void persistShowcase((prev) => ({ ...prev, selectedShowcaseModels: next }));
    },
    [persistShowcase],
  );

  const onChangeTasks = useCallback(
    (next: ShowcaseMatrixTask[]) => {
      void persistShowcase((prev) => ({ ...prev, showcaseMatrixTasks: next }));
    },
    [persistShowcase],
  );

  const onPatchShowcase = useCallback(
    (patch: Partial<TradePointShowcaseActualization>) => {
      void persistShowcase((prev) => ({ ...prev, ...patch }));
    },
    [persistShowcase],
  );

  return (
    <TradePointShowcaseCatalogPanel
      tradePointId={point.id}
      dealerId={dealer.id}
      tradePointName={tradePointDisplayName}
      tradePointCode={point.releaseCode ?? point.id}
      dealerName={dealer.name}
      dealerCode={dealer.releaseCode ?? dealer.id}
      counterpartyCity={point.city ?? dealer.city}
      matrixScopeRegion={dealer.region}
      matrixScopeCity={point.city}
      matrixClientCategory={matrixClientCategory}
      canEdit={canEdit}
      actorUserId={actorUserId}
      actorLabel={actorLabel}
      selectedShowcaseModels={showcaseRec?.selectedShowcaseModels ?? []}
      onChangeSelected={onChangeSelected}
      showcaseMatrixTasks={showcaseRec?.showcaseMatrixTasks ?? []}
      onChangeTasks={onChangeTasks}
      onMarkDirty={() => {}}
      showcaseRec={showcaseRec}
      onPatchShowcase={onPatchShowcase}
    />
  );
}
