/**
 * РОП и РМ на карточке торговой точки (overrides в trade_point_overrides).
 */

import { saveTradePointFields } from "@/lib/use-dealer-field-saver";

export const TP_ROP_RM_OVERRIDES_STORAGE_KEY = "tandoor-trade-point-rop-rm-overrides-v1";
export const TP_ROP_RM_OVERRIDES_EVENT = "tandoor-trade-point-rop-rm-overrides-changed";

export type TpRopRmOverride = {
  ropId: string | null;
  ropName: string | null;
  regionalManagerId: string | null;
  regionalManagerName: string | null;
  updatedAt: string;
};

export type TradePointRopRmOverridesState = {
  byTpId: Record<string, TpRopRmOverride>;
};

function emptyState(): TradePointRopRmOverridesState {
  return { byTpId: {} };
}

function isoNow(): string {
  return new Date().toISOString();
}

export function loadTradePointRopRmOverridesState(): TradePointRopRmOverridesState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(TP_ROP_RM_OVERRIDES_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<TradePointRopRmOverridesState>;
    return { byTpId: p.byTpId && typeof p.byTpId === "object" ? p.byTpId : {} };
  } catch {
    return emptyState();
  }
}

function saveState(state: TradePointRopRmOverridesState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(TP_ROP_RM_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(TP_ROP_RM_OVERRIDES_EVENT));
}

export function getTradePointRopRmOverride(
  tpId: string,
  state = loadTradePointRopRmOverridesState(),
): TpRopRmOverride | null {
  return state.byTpId[tpId] ?? null;
}

export function setTradePointRopRmOverride(
  tpId: string,
  dealerId: string,
  patch: {
    ropId: string | null;
    ropName: string | null;
    regionalManagerId: string | null;
    regionalManagerName: string | null;
  },
): void {
  const state = loadTradePointRopRmOverridesState();
  const byTpId = { ...state.byTpId };

  const hasAny =
    patch.ropId?.trim() ||
    patch.regionalManagerId?.trim() ||
    patch.ropName?.trim() ||
    patch.regionalManagerName?.trim();

  if (!hasAny) {
    delete byTpId[tpId];
  } else {
    byTpId[tpId] = {
      ropId: patch.ropId?.trim() || null,
      ropName: patch.ropName?.trim() || null,
      regionalManagerId: patch.regionalManagerId?.trim() || null,
      regionalManagerName: patch.regionalManagerName?.trim() || null,
      updatedAt: isoNow(),
    };
  }

  saveState({ byTpId });

  const rec = byTpId[tpId];
  void saveTradePointFields(
    tpId,
    {
      rop_id: rec?.ropId ?? null,
      rop_name: rec?.ropName ?? null,
      regional_manager_id: rec?.regionalManagerId ?? null,
      regional_manager_name: rec?.regionalManagerName ?? null,
    },
    dealerId,
    { fieldLabel: "Ответственные ТТ", source: "trade-point-rop-rm-overrides" },
  );
}
