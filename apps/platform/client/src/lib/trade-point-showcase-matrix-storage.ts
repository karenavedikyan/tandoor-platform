import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import { canViewShowcaseDistribution } from "@/lib/showcase-distribution-data";
import { getEffectiveDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import {
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";
import { resolveTradePointMatrixModels } from "@/lib/trade-point-matrix-resolver";
import { normalizeShowcaseMatrixModelId, setMatrixStatus } from "@/lib/showcase-matrix-store";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";

export const SHOWCASE_MATRIX_STORAGE_KEY = "tandoor-trade-point-showcase-matrix-v1";

/** Режим отображения матрицы витрины на карточке торговой точки (клиент). */
export const SHOWCASE_MATRIX_VIEW_MODE_STORAGE_KEY = "tandoor-trade-point-showcase-matrix-view-v1";

export const SHOWCASE_MATRIX_CHANGED_EVENT = "tandoor-trade-point-showcase-matrix-changed";

export type ShowcaseMatrixStatusId = "need_install" | "installed" | "postponed" | "not_relevant";

export type ShowcaseMatrixEntryStored = {
  status: ShowcaseMatrixStatusId;
  comment: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type ShowcaseMatrixHistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

type ShowcaseMatrixStorageV1 = {
  entries: Record<string, ShowcaseMatrixEntryStored>;
  tpHistory: Record<string, ShowcaseMatrixHistoryEntry[]>;
  dealerHistory: Record<string, ShowcaseMatrixHistoryEntry[]>;
};

function emptyStorage(): ShowcaseMatrixStorageV1 {
  return { entries: {}, tpHistory: {}, dealerHistory: {} };
}

export function showcaseMatrixEntryKey(dealerId: string, tradePointId: string, modelId: string): string {
  return `${dealerId}|${tradePointId}|${modelId}`;
}

export function showcaseMatrixTpHistoryKey(dealerId: string, tradePointId: string): string {
  return `${dealerId}|${tradePointId}`;
}

export function loadShowcaseMatrixStorage(): ShowcaseMatrixStorageV1 {
  if (typeof window === "undefined" || !window.localStorage) return emptyStorage();
  try {
    const raw = window.localStorage.getItem(SHOWCASE_MATRIX_STORAGE_KEY);
    if (!raw) return emptyStorage();
    const p = JSON.parse(raw) as Partial<ShowcaseMatrixStorageV1>;
    return {
      entries: p.entries && typeof p.entries === "object" ? p.entries : {},
      tpHistory: p.tpHistory && typeof p.tpHistory === "object" ? p.tpHistory : {},
      dealerHistory: p.dealerHistory && typeof p.dealerHistory === "object" ? p.dealerHistory : {},
    };
  } catch {
    return emptyStorage();
  }
}

export function saveShowcaseMatrixStorage(data: ShowcaseMatrixStorageV1): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SHOWCASE_MATRIX_STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(SHOWCASE_MATRIX_CHANGED_EVENT));
}

export function statusLabelRu(s: ShowcaseMatrixStatusId): string {
  switch (s) {
    case "need_install":
      return "Нужно поставить";
    case "installed":
      return "Стоит на витрине";
    case "postponed":
      return "Отложено";
    case "not_relevant":
      return "Не актуально";
    default:
      return s;
  }
}

function localMatrixEntry(
  dealerId: string,
  tradePointId: string,
  modelId: string,
  storage: ShowcaseMatrixStorageV1,
): ShowcaseMatrixEntryStored | null {
  const key = showcaseMatrixEntryKey(dealerId, tradePointId, modelId);
  const normalizedKey = showcaseMatrixEntryKey(
    dealerId,
    tradePointId,
    normalizeShowcaseMatrixModelId(modelId),
  );
  return storage.entries[key] ?? storage.entries[normalizedKey] ?? null;
}

export function resolveMatrixModelStatus(params: {
  dealerId: string;
  tradePointId: string;
  modelId: string;
  backend: Pick<ShowcaseMatrixEntryDto, "status" | "updatedAt"> | undefined;
  storage: ShowcaseMatrixStorageV1;
}): ShowcaseMatrixStatusId {
  const local = localMatrixEntry(params.dealerId, params.tradePointId, params.modelId, params.storage);
  const backend = params.backend;
  if (backend && local) {
    const backendAt = backend.updatedAt ?? "";
    const localAt = local.updatedAt ?? "";
    return backendAt >= localAt ? (backend.status as ShowcaseMatrixStatusId) : local.status;
  }
  if (backend) return backend.status as ShowcaseMatrixStatusId;
  return local?.status ?? "need_install";
}

export function getEffectiveMatrixStatus(
  dealerId: string,
  tradePointId: string,
  modelId: string,
  storage: ShowcaseMatrixStorageV1,
): ShowcaseMatrixStatusId {
  return localMatrixEntry(dealerId, tradePointId, modelId, storage)?.status ?? "need_install";
}

export function getEffectiveMatrixEntry(
  dealerId: string,
  tradePointId: string,
  modelId: string,
  storage: ShowcaseMatrixStorageV1,
): ShowcaseMatrixEntryStored {
  return (
    localMatrixEntry(dealerId, tradePointId, modelId, storage) ?? {
      status: "need_install",
      comment: "",
      updatedAt: "",
      updatedBy: "",
      updatedByName: "",
    }
  );
}

export function resolveMatrixModelEntry(params: {
  dealerId: string;
  tradePointId: string;
  modelId: string;
  backend: ShowcaseMatrixEntryDto | undefined;
  storage: ShowcaseMatrixStorageV1;
}): ShowcaseMatrixEntryStored {
  const local = localMatrixEntry(params.dealerId, params.tradePointId, params.modelId, params.storage);
  const backend = params.backend;
  if (backend && local) {
    const backendAt = backend.updatedAt ?? "";
    const localAt = local.updatedAt ?? "";
    if (localAt > backendAt) return local;
    return {
      status: backend.status as ShowcaseMatrixStatusId,
      comment: backend.comment ?? "",
      updatedAt: backend.updatedAt,
      updatedBy: backend.updatedBy ?? "",
      updatedByName: backend.updatedByName ?? "",
    };
  }
  if (backend) {
    return {
      status: backend.status as ShowcaseMatrixStatusId,
      comment: backend.comment ?? "",
      updatedAt: backend.updatedAt,
      updatedBy: backend.updatedBy ?? "",
      updatedByName: backend.updatedByName ?? "",
    };
  }
  return getEffectiveMatrixEntry(params.dealerId, params.tradePointId, params.modelId, params.storage);
}

function countsAsMissing(status: ShowcaseMatrixStatusId): boolean {
  return status === "need_install" || status === "postponed";
}

function countsAsInstalled(status: ShowcaseMatrixStatusId): boolean {
  return status === "installed";
}

export type TradePointShowcaseMatrixPointStats = {
  tradePointId: string;
  tradePointName: string;
  addressLine: string;
  totalModels: number;
  installedCount: number;
  missingCount: number;
  completionPct: number;
};

export type DealerShowcaseMatrixSummary = {
  totalTradePoints: number;
  pointsFull: number;
  pointsWithDeficit: number;
  totalMissingModels: number;
  topMissingModels: { modelId: string; modelName: string; missingPoints: number }[];
  deficitPoints: TradePointShowcaseMatrixPointStats[];
};

export function computeTradePointShowcaseMatrixStats(
  dealer: DealerRow,
  point: DealerTradePoint,
  storage: ShowcaseMatrixStorageV1,
): { total: number; installed: number; missing: number; completionPct: number } {
  const models = resolveTradePointMatrixModels({
    dealerId: dealer.id,
    tradePointId: point.id,
    clientCategory: dealer.clientCategory,
    region: dealer.region,
    city: point.city,
  });
  let installed = 0;
  let missing = 0;
  let notRelevant = 0;
  for (const m of models) {
    const st = getEffectiveMatrixStatus(dealer.id, point.id, m.id, storage);
    if (countsAsInstalled(st)) installed += 1;
    else if (countsAsMissing(st)) missing += 1;
    else if (st === "not_relevant") notRelevant += 1;
  }
  const total = models.length;
  const relevant = total - notRelevant;
  const completionPct = relevant <= 0 ? 100 : Math.min(100, Math.round((installed / relevant) * 100));
  return { total, installed, missing, completionPct };
}

export function computeDealerShowcaseMatrixSummary(dealer: DealerRow, storage: ShowcaseMatrixStorageV1): DealerShowcaseMatrixSummary {
  const effective = getEffectiveDealerTradePoints(dealer, { includeArchived: false }).map((m) => m.point);
  const tradePoints = effective.filter((p) => p.status?.trim() !== "Архив");
  const totalTradePoints = tradePoints.length;
  const modelMissingById = new Map<string, { name: string; n: number }>();
  const deficitPoints: TradePointShowcaseMatrixPointStats[] = [];
  let pointsFull = 0;
  let pointsWithDeficit = 0;
  let totalMissingModels = 0;

  for (const tp of tradePoints) {
    const models = resolveTradePointMatrixModels({
      dealerId: dealer.id,
      tradePointId: tp.id,
      clientCategory: dealer.clientCategory,
      region: dealer.region,
      city: tp.city,
    });
    let installed = 0;
    let missing = 0;
    let notRelevant = 0;
    for (const m of models) {
      const st = getEffectiveMatrixStatus(dealer.id, tp.id, m.id, storage);
      if (countsAsInstalled(st)) installed += 1;
      else if (countsAsMissing(st)) {
        missing += 1;
        totalMissingModels += 1;
        const prev = modelMissingById.get(m.id);
        if (prev) prev.n += 1;
        else modelMissingById.set(m.id, { name: m.name, n: 1 });
      } else if (st === "not_relevant") {
        notRelevant += 1;
      }
    }
    const total = models.length;
    const relevant = total - notRelevant;
    const completionPct = relevant <= 0 ? 100 : Math.min(100, Math.round((installed / relevant) * 100));
    const addressLine = [tp.city, tp.address]
      .map((x) => x.trim())
      .filter((x) => x && x !== "—" && x !== "-")
      .join(", ");
    if (total === 0) continue;
    if (missing > 0) {
      pointsWithDeficit += 1;
      deficitPoints.push({
        tradePointId: tp.id,
        tradePointName: tp.name,
        addressLine: addressLine || tp.name,
        totalModels: total,
        installedCount: installed,
        missingCount: missing,
        completionPct,
      });
    } else {
      pointsFull += 1;
    }
  }

  const topMissingModels = Array.from(modelMissingById.entries())
    .map(([modelId, v]) => ({ modelId, modelName: v.name, missingPoints: v.n }))
    .sort((a, b) => b.missingPoints - a.missingPoints || a.modelId.localeCompare(b.modelId))
    .slice(0, 3);

  return {
    totalTradePoints,
    pointsFull,
    pointsWithDeficit,
    totalMissingModels,
    topMissingModels,
    deficitPoints: deficitPoints.sort((a, b) => b.missingCount - a.missingCount || a.tradePointId.localeCompare(b.tradePointId)),
  };
}

export function getShowcaseMatrixTpHistoryEvents(
  dealerId: string,
  tradePointId: string,
  storage: ShowcaseMatrixStorageV1,
): ShowcaseMatrixHistoryEntry[] {
  const key = showcaseMatrixTpHistoryKey(dealerId, tradePointId);
  return [...(storage.tpHistory[key] ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function getShowcaseMatrixDealerHistoryEvents(dealerId: string, storage: ShowcaseMatrixStorageV1): ShowcaseMatrixHistoryEntry[] {
  return [...(storage.dealerHistory[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function canViewTradePointShowcaseMatrix(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canViewShowcaseDistribution(profile, dealer);
}

/** Как canEditClientNextStep: менеджер — свои клиенты, РОП — команда, директор — все, маркетолог/аналитик — без правки. */
export function canEditTradePointShowcaseMatrix(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canEditClientNextStep(profile, dealer);
}

export function isTradePointShowcaseMatrixReadOnly(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return !canEditTradePointShowcaseMatrix(profile, dealer);
}

function formatRuDayFromIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function upsertShowcaseMatrixModelState(payload: {
  dealerId: string;
  tradePointId: string;
  model: ShowcaseMatrixModelDefinition;
  status: ShowcaseMatrixStatusId;
  comment: string;
  actorUserId: string;
  actorName: string;
}): ShowcaseMatrixStorageV1 {
  const storage = loadShowcaseMatrixStorage();
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const key = showcaseMatrixEntryKey(payload.dealerId, payload.tradePointId, payload.model.id);
  const prevEntry = storage.entries[key];
  const prevStatus: ShowcaseMatrixStatusId = prevEntry?.status ?? "need_install";
  const statusChanged = prevStatus !== payload.status;

  storage.entries[key] = {
    status: payload.status,
    comment: payload.comment.trim(),
    updatedAt: now,
    updatedBy: payload.actorUserId,
    updatedByName: payload.actorName,
  };

  if (statusChanged) {
    const meta = `${formatRuDayFromIso(day)} · ${payload.actorName}`;
    const body = `Витрина точки: ${payload.model.name} — ${statusLabelRu(payload.status)}.${payload.comment.trim() ? ` Комментарий: ${payload.comment.trim()}` : ""}`;

    const hist: ShowcaseMatrixHistoryEntry = {
      id: `smx-tp-${payload.dealerId}-${payload.tradePointId}-${payload.model.id}-${Date.now()}`,
      at: now,
      meta,
      body,
    };
    const tpKey = showcaseMatrixTpHistoryKey(payload.dealerId, payload.tradePointId);
    const prevTp = storage.tpHistory[tpKey] ?? [];
    storage.tpHistory[tpKey] = [hist, ...prevTp].slice(0, 40);

    const histDealer: ShowcaseMatrixHistoryEntry = {
      id: `smx-dl-${payload.dealerId}-${payload.tradePointId}-${payload.model.id}-${Date.now()}`,
      at: now,
      meta,
      body: `${payload.tradePointId}: ${body}`,
    };
    const prevD = storage.dealerHistory[payload.dealerId] ?? [];
    storage.dealerHistory[payload.dealerId] = [histDealer, ...prevD].slice(0, 60);
  }

  saveShowcaseMatrixStorage(storage);

  // [prompt-353] mirror status to cache-v1 (used by segment-summary and other consumers)
  try {
    const def = SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((d) => d.id === payload.model.id);
    const modelType = def?.type ?? payload.model.type;
    const placementSegment =
      modelType === "entrance"
        ? "vh"
        : modelType === "interior"
          ? "mk"
          : modelType === "hardware"
            ? "hardware"
            : null;
    setMatrixStatus({
      dealerId: payload.dealerId,
      tradePointId: payload.tradePointId,
      targetKind: "model",
      targetId: payload.model.id,
      status: payload.status,
      comment: payload.comment.trim() || null,
      updatedBy: payload.actorUserId,
      updatedByName: payload.actorName,
      placementSegment,
    });
  } catch (e) {
    if (typeof console !== "undefined") {
      console.warn("[prompt-353] mirror to cache-v1 failed", e);
    }
  }

  return storage;
}
