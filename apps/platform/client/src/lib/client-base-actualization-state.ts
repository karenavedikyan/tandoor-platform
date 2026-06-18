/**
 * Персистентное состояние актуализации клиентской базы (сервер + fallback).
 * Расширяется в следующих PR формами и UI.
 */

import type { ClientCategoryId } from "./client-category.js";

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
  /**
   * Поля анкеты. В т. ч. коммерческие (актуализация): `hasDoorWarehouse`, `hasHardwareWarehouse`,
   * `isTandoorClubMember`, `hasSpecialTerms`, `isCashbackClient` — `boolean | null` (null = «не указано»),
   * комментарии `*Comment`, `external1cCode` (строка). См. `dealer-commercial-characteristics.ts` и документацию.
   */
  fields: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  /** Последнее сохранение карточки (для аудита и метрик). */
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
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
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
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
  ownerTeamAtArchive?: string | null;
  ownerCode?: string | null;
};

/** Мягкое архивирование вручную созданного клиента (остаётся в manuallyCreatedDealersById). */
export type ArchivedDealerInfo = {
  dealerId: string;
  archivedAt: string;
  archivedBy: string;
  archivedByName: string;
  source: ActualizationSource;
  /** Промт 398: команда на момент архивации (стабильность при смене команды). */
  ownerTeamAtArchive?: string | null;
  /** Промт 398: client code / external code на момент архивации. */
  ownerCode?: string | null;
};

/** Корзина клиента — хранится 14 дней, затем чистится cron'ом. Отдельная сущность от архива. */
export type TrashedDealerSource =
  | "client_bulk_delete"
  | "client_card_delete"
  | "manual_actualization";

export type TrashedDealerInfo = {
  dealerId: string;
  trashedAt: string;
  trashedBy: string;
  trashedByName: string;
  expiresAt: string;
  source: TrashedDealerSource;
  /** Промт 398: команда удаляющего на момент удаления. */
  ownerTeamAtTrash?: string | null;
  /** Промт 398: client code на момент удаления. */
  ownerCode?: string | null;
  /**
   * Снимок ключевых полей на момент удаления — чтобы корзина оставалась читаемой,
   * даже если исходная запись пропала из state.
   */
  snapshot: {
    fullName: string | null;
    city: string | null;
    inn: string | null;
    dealerCode: string | null;
    legalEntityName: string | null;
  };
};

/** Корзина торговой точки. Симметрично TrashedDealerInfo. */
export type TrashedTradePointSource =
  | "client_bulk_delete"
  | "client_card_delete"
  | "manual_actualization";

export type TrashedTradePointInfo = {
  tradePointId: string;
  dealerId: string;
  trashedAt: string;
  trashedBy: string;
  trashedByName: string;
  expiresAt: string;
  source: TrashedTradePointSource;
  ownerTeamAtTrash?: string | null;
  ownerCode?: string | null;
  snapshot: {
    name: string | null;
    address: string | null;
    city: string | null;
    tradePointCode: string | null;
    dealerFullName: string | null;
  };
};

export type ArchivedLegalEntityInfo = {
  legalEntityId: string;
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

/** Тип портала для учёта выбранных моделей на витрине (снимок, не весь каталог). */
export type ShowcaseSelectedPortalType = "entrance" | "interior" | "hardware" | "other";

/** Выбранная на витрине модель (минимальный снимок; детали подтягиваются из каталога по productId). */
export type TradePointShowcaseSelectedModel = {
  productId: string;
  productName: string;
  productType: string;
  selectedAt: string;
  selectedBy: string;
  selectedByName: string;
  quantity?: number;
  portalType?: ShowcaseSelectedPortalType;
  comment?: string;
};

/** Локальная задача по дефициту обязательной матрицы (без Bitrix до отдельной интеграции). */
export type ShowcaseMatrixTask = {
  id: string;
  tradePointId: string;
  dealerId: string;
  productId: string;
  productName: string;
  reason: "matrix_required_missing";
  createdAt: string;
  createdBy: string;
  createdByName: string;
  status: "new" | "done";
};

/** Тип фото клиента / ТТ в актуализации (только URL в state, без base64). */
export type ActualizationEntityPhotoKind = "facade" | "logo" | "showcase" | "interior" | "other";

/** Метаданные фото дилера или торговой точки. */
export type ActualizationEntityPhoto = {
  id: string;
  entityId: string;
  entityType: "dealer" | "trade_point";
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  kind: ActualizationEntityPhotoKind;
  title?: string;
  comment?: string;
  isCover: boolean;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName?: string;
  sortOrder?: number;
  /** Мягкое скрытие из галереи (не удаляем запись с диска хранилища в этом PR). */
  archivedAt?: string;
  archivedBy?: string;
  archivedByName?: string;
};

/** Параметры витрины / порталов по торговой точке (актуализация). */
export type TradePointShowcaseActualization = {
  tradePointId: string;
  dealerId: string;
  /** default = true; null допустим только для legacy-снапшотов и трактуется как true */
  hasShowcase: boolean | null;
  totalPortals: number | null;
  entrancePortals: number | null;
  interiorPortals: number | null;
  /** Секций / композиций фурнитуры в ТТ (не входит в totalPortals). */
  hardwareSections: number | null;
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
  /** Модели, реально стоящие на витрине (галочки каталога). Старые записи без поля — []. */
  selectedShowcaseModels?: TradePointShowcaseSelectedModel[];
  /** Явно созданные из матрицы задачи (не автоматически при выборе). */
  showcaseMatrixTasks?: ShowcaseMatrixTask[];
};

/**
 * Промт 355: дефолт hasShowcase = true.
 * null допустим только для legacy-снапшотов (localStorage / cache-v1 mirror)
 * и трактуется как true. Явный false означает «Нет витрины».
 */
export function normalizeHasShowcase(v: boolean | null | undefined): boolean {
  return v === false ? false : true;
}

export function normalizeTradePointShowcaseActualization(
  sh: TradePointShowcaseActualization,
): TradePointShowcaseActualization {
  const hasShowcase = normalizeHasShowcase(sh.hasShowcase);
  const hardwareSections = sh.hardwareSections ?? null;
  if (hasShowcase === sh.hasShowcase && hardwareSections === sh.hardwareSections) return sh;
  return { ...sh, hasShowcase, hardwareSections };
}

/** Нормализует legacy null → true во всех записях витрины при гидрации снапшота. */
export function normalizeActualizationStateShowcases(state: ActualizationState): ActualizationState {
  const src = state.tradePointShowcaseActualizationById;
  let changed = false;
  const next: Record<string, TradePointShowcaseActualization> = {};
  for (const [id, sh] of Object.entries(src)) {
    const normalized = normalizeTradePointShowcaseActualization(sh);
    if (normalized !== sh) changed = true;
    next[id] = normalized;
  }
  if (!changed) return state;
  return { ...state, tradePointShowcaseActualizationById: next };
}

export type ActualizationState = {
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  /** Ручное присвоение бизнес-категории (ТОП) для любого клиента, в т. ч. импортированного. */
  clientCategoryOverridesById: Record<string, ClientCategoryId>;
  dealerOverridesById: Record<string, DealerActualizationOverride>;
  manuallyCreatedDealersById: Record<string, ManualDealer>;
  archivedDealersById: Record<string, ArchivedDealerInfo>;
  tradePointOverridesById: Record<string, TradePointActualizationOverride>;
  manuallyCreatedTradePointsById: Record<string, ManualTradePoint>;
  archivedTradePointsById: Record<string, ArchivedTradePointInfo>;
  /** Мягкое скрытие юрлица (release и manual); ключ — legalEntityId. */
  archivedLegalEntitiesById: Record<string, ArchivedLegalEntityInfo>;
  legalEntityOverridesByDealerId: Record<string, LegalEntityActualizationState>;
  dealerCardViewSettingsByUserId: Record<string, DealerCardViewSettings>;
  unloadingOrderByDealerId?: Record<string, number>;
  routeOrderByRouteId?: Record<string, Record<string, number>>;
  /** contactId -> запись (dealerId внутри). */
  dealerActualizationContactsById: Record<string, DealerActualizationContact>;
  archivedDealerContactsById: Record<string, ArchivedDealerContactInfo>;
  tradePointShowcaseActualizationById: Record<string, TradePointShowcaseActualization>;
  dealerActualizationAuditByDealerId: Record<string, DealerActualizationAudit>;
  /** Фото дилеров: dealerId → список (в т. ч. с archivedAt). */
  dealerPhotosByDealerId: Record<string, ActualizationEntityPhoto[]>;
  /** Фото торговых точек: tradePointId → список. */
  tradePointPhotosByTradePointId: Record<string, ActualizationEntityPhoto[]>;
  /** Корзина клиентов (отдельно от архива). Хранится 14 дней. */
  trashedDealersById: Record<string, TrashedDealerInfo>;
  /** Корзина торговых точек. */
  trashedTradePointsById: Record<string, TrashedTradePointInfo>;
};

/** TTL корзины в миллисекундах (14 дней). */
export const TRASH_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

/** Вычисляет ISO-дату истечения корзины относительно момента удаления. */
export function computeTrashExpiresAt(trashedAtIso: string): string {
  const t = Date.parse(trashedAtIso);
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + TRASH_RETENTION_MS).toISOString();
}

export function createEmptyActualizationState(): ActualizationState {
  return {
    version: ACTUALIZATION_STATE_VERSION,
    updatedAt: null,
    updatedBy: null,
    clientCategoryOverridesById: {},
    dealerOverridesById: {},
    manuallyCreatedDealersById: {},
    archivedDealersById: {},
    tradePointOverridesById: {},
    manuallyCreatedTradePointsById: {},
    archivedTradePointsById: {},
    archivedLegalEntitiesById: {},
    legalEntityOverridesByDealerId: {},
    dealerCardViewSettingsByUserId: {},
    unloadingOrderByDealerId: {},
    routeOrderByRouteId: {},
    dealerActualizationContactsById: {},
    archivedDealerContactsById: {},
    tradePointShowcaseActualizationById: {},
    dealerActualizationAuditByDealerId: {},
    dealerPhotosByDealerId: {},
    tradePointPhotosByTradePointId: {},
    trashedDealersById: {},
    trashedTradePointsById: {},
  };
}

/** Поверхностное объединение patch в base (для MVP; глубокий merge полей — в следующих PR). */
export function mergeActualizationState(base: ActualizationState, patch: Partial<ActualizationState>): ActualizationState {
  return {
    ...base,
    ...patch,
    version: typeof patch.version === "number" ? patch.version : base.version,
    clientCategoryOverridesById: {
      ...base.clientCategoryOverridesById,
      ...(patch.clientCategoryOverridesById ?? {}),
    },
    dealerOverridesById: { ...base.dealerOverridesById, ...(patch.dealerOverridesById ?? {}) },
    manuallyCreatedDealersById: { ...base.manuallyCreatedDealersById, ...(patch.manuallyCreatedDealersById ?? {}) },
    /** Полная замена: иначе удаление ключа (восстановление из архива) не сработает при spread `{ ...base, ...patch }`. */
    archivedDealersById: patch.archivedDealersById ?? base.archivedDealersById,
    tradePointOverridesById: { ...base.tradePointOverridesById, ...(patch.tradePointOverridesById ?? {}) },
    manuallyCreatedTradePointsById: {
      ...base.manuallyCreatedTradePointsById,
      ...(patch.manuallyCreatedTradePointsById ?? {}),
    },
    archivedTradePointsById: patch.archivedTradePointsById ?? base.archivedTradePointsById,
    archivedLegalEntitiesById: patch.archivedLegalEntitiesById ?? base.archivedLegalEntitiesById,
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
    archivedDealerContactsById: patch.archivedDealerContactsById ?? base.archivedDealerContactsById,
    tradePointShowcaseActualizationById: {
      ...base.tradePointShowcaseActualizationById,
      ...(patch.tradePointShowcaseActualizationById ?? {}),
    },
    dealerActualizationAuditByDealerId: {
      ...base.dealerActualizationAuditByDealerId,
      ...(patch.dealerActualizationAuditByDealerId ?? {}),
    },
    dealerPhotosByDealerId: { ...base.dealerPhotosByDealerId, ...(patch.dealerPhotosByDealerId ?? {}) },
    tradePointPhotosByTradePointId: {
      ...base.tradePointPhotosByTradePointId,
      ...(patch.tradePointPhotosByTradePointId ?? {}),
    },
    /**
     * Полная замена — иначе удаление ключа (восстановление из корзины) не сработает.
     * Симметрично archivedDealersById.
     */
    trashedDealersById: patch.trashedDealersById ?? base.trashedDealersById,
    trashedTradePointsById: patch.trashedTradePointsById ?? base.trashedTradePointsById,
  };
}
