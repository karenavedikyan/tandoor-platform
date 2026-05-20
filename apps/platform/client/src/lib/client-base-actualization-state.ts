/**
 * Персистентное состояние актуализации клиентской базы (сервер + fallback).
 * Расширяется в следующих PR формами и UI.
 */

export const ACTUALIZATION_STATE_VERSION = 1;

export type ActualizationSource = "manual_actualization" | "client_soft_archive";

export type DealerActualizationOverride = {
  dealerId: string;
  fields: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  source: ActualizationSource;
};

export type ManualDealer = {
  id: string;
  /** Человекочитаемый код TND-CL-000001 (в UI); legacy: MA-MANUAL-*. */
  internalCode?: string;
  fields: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  source: ActualizationSource;
};

export type TradePointActualizationOverride = {
  tradePointId: string;
  dealerId: string;
  fields: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  source: ActualizationSource;
};

export type ManualTradePoint = {
  id: string;
  dealerId: string;
  /** Человекочитаемый код TND-TP-000001; для старых записей может отсутствовать. */
  internalCode?: string;
  fields: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  source: ActualizationSource;
};

export type ArchivedTradePointInfo = {
  tradePointId: string;
  dealerId: string;
  archivedAt: string;
  archivedBy: string;
  archivedByName: string;
  reason?: string;
  source: ActualizationSource;
};

/** Мягкое архивирование вручную созданного клиента (остаётся в manuallyCreatedDealersById). */
export type ArchivedDealerInfo = {
  dealerId: string;
  archivedAt: string;
  archivedBy: string;
  archivedByName: string;
  source: ActualizationSource;
};

export type LegalEntityActualizationState = {
  createdById: string;
  overridesById: Record<string, unknown>;
  archivedById: Record<string, unknown>;
  primaryLegalEntityId?: string;
};

export type DealerCardViewSettings = {
  hiddenBlockIds: string[];
  actualizationPresetEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
};

/** Контакт клиента в актуализации (единый источник правды для ЛК). */
export type DealerActualizationContact = {
  id: string;
  dealerId: string;
  fullName: string;
  /** owner | lpr | buyer | accountant | logistics | seller | other */
  role: string;
  phone: string;
  email: string;
  messenger: string;
  comment: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type ArchivedDealerContactInfo = {
  contactId: string;
  dealerId: string;
  archivedAt: string;
  archivedBy: string;
  archivedByName: string;
};

export type DealerActualizationAudit = {
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  lastUpdatedByName: string;
};

/** Параметры витрины / порталов по торговой точке (актуализация). */
export type TradePointShowcaseActualization = {
  tradePointId: string;
  dealerId: string;
  /** null = не заполнено */
  hasShowcase: boolean | null;
  totalPortals: number | null;
  entrancePortals: number | null;
  interiorPortals: number | null;
  showcaseAreaSqm: number | null;
  showcaseComment: string;
  tandoorTotalPortals: number | null;
  tandoorEntrancePortals: number | null;
  tandoorInteriorPortals: number | null;
  competitorPortals: number | null;
  competitorsListed: string;
  fillingComment: string;
  hasExpansionPotential: boolean | null;
  additionalPortalsPotential: number | null;
  /** high | medium | low */
  showcasePriority: string;
  firstPriorityNeed: string;
  rmRopComment: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type ActualizationState = {
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  dealerOverridesById: Record<string, DealerActualizationOverride>;
  manuallyCreatedDealersById: Record<string, ManualDealer>;
  archivedDealersById: Record<string, ArchivedDealerInfo>;
  tradePointOverridesById: Record<string, TradePointActualizationOverride>;
  manuallyCreatedTradePointsById: Record<string, ManualTradePoint>;
  archivedTradePointsById: Record<string, ArchivedTradePointInfo>;
  legalEntityOverridesByDealerId: Record<string, LegalEntityActualizationState>;
  dealerCardViewSettingsByUserId: Record<string, DealerCardViewSettings>;
  unloadingOrderByDealerId?: Record<string, number>;
  routeOrderByRouteId?: Record<string, Record<string, number>>;
  /** contactId -> запись (dealerId внутри). */
  dealerActualizationContactsById: Record<string, DealerActualizationContact>;
  archivedDealerContactsById: Record<string, ArchivedDealerContactInfo>;
  tradePointShowcaseActualizationById: Record<string, TradePointShowcaseActualization>;
  dealerActualizationAuditByDealerId: Record<string, DealerActualizationAudit>;
};

export function createEmptyActualizationState(): ActualizationState {
  return {
    version: ACTUALIZATION_STATE_VERSION,
    updatedAt: null,
    updatedBy: null,
    dealerOverridesById: {},
    manuallyCreatedDealersById: {},
    archivedDealersById: {},
    tradePointOverridesById: {},
    manuallyCreatedTradePointsById: {},
    archivedTradePointsById: {},
    legalEntityOverridesByDealerId: {},
    dealerCardViewSettingsByUserId: {},
    unloadingOrderByDealerId: {},
    routeOrderByRouteId: {},
    dealerActualizationContactsById: {},
    archivedDealerContactsById: {},
    tradePointShowcaseActualizationById: {},
    dealerActualizationAuditByDealerId: {},
  };
}

/** Поверхностное объединение patch в base (для MVP; глубокий merge полей — в следующих PR). */
export function mergeActualizationState(base: ActualizationState, patch: Partial<ActualizationState>): ActualizationState {
  return {
    ...base,
    ...patch,
    version: typeof patch.version === "number" ? patch.version : base.version,
    dealerOverridesById: { ...base.dealerOverridesById, ...(patch.dealerOverridesById ?? {}) },
    manuallyCreatedDealersById: { ...base.manuallyCreatedDealersById, ...(patch.manuallyCreatedDealersById ?? {}) },
    archivedDealersById: { ...base.archivedDealersById, ...(patch.archivedDealersById ?? {}) },
    tradePointOverridesById: { ...base.tradePointOverridesById, ...(patch.tradePointOverridesById ?? {}) },
    manuallyCreatedTradePointsById: {
      ...base.manuallyCreatedTradePointsById,
      ...(patch.manuallyCreatedTradePointsById ?? {}),
    },
    archivedTradePointsById: { ...base.archivedTradePointsById, ...(patch.archivedTradePointsById ?? {}) },
    legalEntityOverridesByDealerId: {
      ...base.legalEntityOverridesByDealerId,
      ...(patch.legalEntityOverridesByDealerId ?? {}),
    },
    dealerCardViewSettingsByUserId: {
      ...base.dealerCardViewSettingsByUserId,
      ...(patch.dealerCardViewSettingsByUserId ?? {}),
    },
    unloadingOrderByDealerId: patch.unloadingOrderByDealerId ?? base.unloadingOrderByDealerId,
    routeOrderByRouteId: patch.routeOrderByRouteId ?? base.routeOrderByRouteId,
    dealerActualizationContactsById: {
      ...base.dealerActualizationContactsById,
      ...(patch.dealerActualizationContactsById ?? {}),
    },
    archivedDealerContactsById: {
      ...base.archivedDealerContactsById,
      ...(patch.archivedDealerContactsById ?? {}),
    },
    tradePointShowcaseActualizationById: {
      ...base.tradePointShowcaseActualizationById,
      ...(patch.tradePointShowcaseActualizationById ?? {}),
    },
    dealerActualizationAuditByDealerId: {
      ...base.dealerActualizationAuditByDealerId,
      ...(patch.dealerActualizationAuditByDealerId ?? {}),
    },
  };
}
