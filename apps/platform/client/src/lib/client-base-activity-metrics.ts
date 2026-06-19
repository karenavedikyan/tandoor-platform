/**
 * Метрики и псевдо-события дашборда «Актуализация базы» из ActualizationState.
 * Атрибуция действий — по полям createdBy / updatedBy / archivedBy / uploadedBy и *Name.
 */

import type { ActualizationState, LegalEntityActualizationState } from "./client-base-actualization-state.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { getDealerRegionalManagerDisplay } from "./dealer-base-mock-data.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import {
  getAllSalesManagers,
  getSalesUserById,
  getTeamById,
  getTeamLeadForTeam,
  type SalesUser,
} from "./sales-control-data.js";
import { isRopOrManagerAllFilter } from "./rop-manager-filters.js";
import {
  mergeLegalEntitiesForActualization,
  mergeTradePointsActiveForActualization,
} from "./client-base-actualization-data-merge.js";
import { buildTradePointListForActualization } from "./trade-point-list-for-actualization.js";

/** Безопасная нормализация текста из API/состояния (undefined, не-строки). */
export function normalizeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

/** Служебный id агрегата, когда в событии нет пользователя / неизвестный actor. */
export const ACTIVITY_UNKNOWN_USER_ID = "__unset__";

/** Подпись в UI для событий без распознанного автора. */
export const ACTIVITY_UNKNOWN_DISPLAY = "Автор не определён";

export function isActivityUnknownUserId(id: string): boolean {
  return id === ACTIVITY_UNKNOWN_USER_ID;
}

export type ActivityPeriodPreset = "today" | "yesterday" | "7d" | "30d" | "all";

export type ActivityTypeFilter = "all" | "dealers" | "trade_points" | "legal" | "photos" | "showcase" | "archive";

export type ActivityEventKind =
  | "manual_dealer"
  | "dealer_updated"
  | "manual_trade_point"
  | "trade_point_updated"
  | "legal_entity"
  | "photo"
  | "showcase"
  | "contact"
  | "archive_legal"
  | "archive_contact"
  | "matrix_task";

export type ActivityEvent = {
  id: string;
  kind: ActivityEventKind;
  atMs: number;
  userId: string;
  userName: string;
  label: string;
  dealerId?: string;
  tradePointId?: string;
};

function isoToMs(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Событие без календарной даты в записи — учитывается только при пресете периода «Всё время»
 * (см. inActivityRange).
 */
export const ACTIVITY_NO_CALENDAR_TIME_MS = -910010020000 as const;

function firstResolvedActivityMs(...candidates: (string | null | undefined)[]): number | null {
  for (const c of candidates) {
    const t = isoToMs(c);
    if (t != null) return t;
  }
  return null;
}

/** Дата активности ручной записи: поля сущности → updatedAt снимка state (для командной загрузки). */
export function resolveManualEntityActivityMs(
  recordCreatedAt: string | null | undefined,
  recordUpdatedAt: string | null | undefined,
  snapshotUpdatedAt: string | null | undefined,
  options: { useSnapshotFallback: boolean },
): number {
  const direct = firstResolvedActivityMs(recordCreatedAt, recordUpdatedAt);
  if (direct != null) return direct;
  if (options.useSnapshotFallback) {
    const snap = firstResolvedActivityMs(snapshotUpdatedAt);
    if (snap != null) return snap;
  }
  return ACTIVITY_NO_CALENDAR_TIME_MS;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Диапазон [startMs, endMs) в локальной TZ для пресета; `all` → null. */
export function activityPeriodToRange(preset: ActivityPeriodPreset): { startMs: number; endMs: number } | null {
  if (preset === "all") return null;
  const now = new Date();
  const end = startOfLocalDay(now);
  end.setDate(end.getDate() + 1);
  const endMs = end.getTime();
  const start = new Date(end);
  if (preset === "today") {
    start.setDate(start.getDate() - 1);
  } else if (preset === "yesterday") {
    end.setTime(start.getTime());
    start.setDate(start.getDate() - 2);
    return { startMs: start.getTime(), endMs: end.getTime() - 86400000 };
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 30);
  }
  return { startMs: start.getTime(), endMs };
}

export function previousActivityRange(range: { startMs: number; endMs: number } | null): { startMs: number; endMs: number } | null {
  if (!range) return null;
  const len = range.endMs - range.startMs;
  return { startMs: range.startMs - len, endMs: range.startMs };
}

export function inActivityRange(atMs: number, range: { startMs: number; endMs: number } | null): boolean {
  if (!range) return true;
  if (atMs === ACTIVITY_NO_CALENDAR_TIME_MS) return false;
  return atMs >= range.startMs && atMs < range.endMs;
}

/**
 * Имя для дашборда активности.
 * Порядок: явное *Name из state → справочник sales по userId → менеджер клиента, если releaseManagerId совпал с userId
 * → сырой userId → менеджер из строки клиента (если userId пуст и известен dealerId) → «Автор не определён».
 * Архивы и др. попадают сюда без автора, если в форме не записали archivedBy / *Name или id не из справочника.
 */
function resolveUserName(
  userId: string | undefined | null,
  explicitName: string | undefined,
  dealerById: Map<string, DealerRow>,
  ctx?: { dealerId?: string },
): string {
  const ex = normalizeText(explicitName);
  if (ex && ex !== "—") return ex;
  const uid = normalizeText(userId);
  const u = getSalesUserById(uid);
  if (normalizeText(u?.name)) return normalizeText(u?.name);
  for (const row of Array.from(dealerById.values())) {
    if (row.releaseManagerId === uid && normalizeText(row.manager)) return normalizeText(row.manager);
  }
  if (uid && uid !== "unknown") return uid;
  const dId = normalizeText(ctx?.dealerId);
  if (dId) {
    const row = dealerById.get(dId);
    const mgr = normalizeText(row?.manager);
    if (mgr && mgr !== "—") return mgr;
  }
  return ACTIVITY_UNKNOWN_DISPLAY;
}

function normalizeActorUserId(raw: string | undefined | null): string {
  const u = normalizeText(raw);
  if (!u || u === "unknown") return ACTIVITY_UNKNOWN_USER_ID;
  return u;
}

function pushEv(out: ActivityEvent[], e: Omit<ActivityEvent, "id"> & { id?: string }) {
  const userId = normalizeActorUserId(e.userId);
  const userName = normalizeText(e.userName) || ACTIVITY_UNKNOWN_DISPLAY;
  const id = e.id ?? `${e.kind}-${e.atMs}-${userId}-${Math.random().toString(36).slice(2, 8)}`;
  out.push({ ...e, id, userId, userName });
}

function strField(o: Record<string, unknown>, k: string): string {
  return normalizeText(o[k]);
}

/** Явный user id в данных юрлица (без подстановки «unknown»). */
function legalEntityActorRaw(o: Record<string, unknown>, st: LegalEntityActualizationState): string {
  return normalizeText(o.updatedBy) || normalizeText(o.createdBy) || normalizeText(st.createdById);
}

/** Fallback на ответственного по строке клиента, если в override нет updatedBy. */
function actorWithDealerFallback(
  primary: string | undefined | null,
  dealerId: string | undefined,
  dealerById: Map<string, DealerRow>,
): string {
  const p = normalizeText(primary);
  if (p) return p;
  const dId = normalizeText(dealerId);
  if (!dId) return "";
  const row = dealerById.get(dId);
  return normalizeText(row?.releaseManagerId) || "";
}

export type ActivityCollection = {
  /** События, участвующие в score и рейтинге менеджеров. */
  events: ActivityEvent[];
  /**
   * Массовые/служебные записи без автора (типично импорт архива или snapshot юрлиц без createdBy).
   * Не входят в score; показываются в диалоге «Автор не определён» как пояснение.
   */
  excludedTechnical: ActivityEvent[];
};

export type CollectActivityBucketsOptions = {
  /**
   * Владелец снимка state (менеджер): для записей без createdBy/updatedBy подставляем его userId
   * и цепочку дат до `state.updatedAt`.
   */
  activitySourceUserId?: string;
};

/**
 * Сбор псевдо-событий для дашборда. Архивы и юрлица без archivedBy/updatedBy не попадают в рейтинг —
 * иначе тысячи строк с `unknown` давали «Автор не определён» с гигантским score (production).
 */
export function collectActivityBuckets(
  state: ActualizationState,
  dealerRows: DealerRow[],
  opts?: CollectActivityBucketsOptions,
): ActivityCollection {
  const dealerById = new Map(dealerRows.map((r) => [r.id, r]));
  const events: ActivityEvent[] = [];
  const excludedTechnical: ActivityEvent[] = [];
  const src = normalizeText(opts?.activitySourceUserId);

  for (const d of Object.values(state.manuallyCreatedDealersById)) {
    const f = (d.fields ?? {}) as Record<string, unknown>;
    const name = strField(f, "name") || d.internalCode || d.id;
    let atMs: number;
    if (src) {
      atMs = resolveManualEntityActivityMs(d.createdAt, d.updatedAt, state.updatedAt, { useSnapshotFallback: true });
    } else {
      const t = isoToMs(d.createdAt);
      if (t == null) continue;
      atMs = t;
    }
    const actorId =
      normalizeText(d.createdBy) ||
      strField(f, "managerUserId") ||
      strField(f, "releaseManagerId") ||
      actorWithDealerFallback("", d.id, dealerById) ||
      src;
    if (!actorId) {
      pushEv(excludedTechnical, {
        kind: "manual_dealer",
        atMs,
        userId: "",
        userName: ACTIVITY_UNKNOWN_DISPLAY,
        label: `Создал клиента: ${name}`,
        dealerId: d.id,
      });
      continue;
    }
    pushEv(events, {
      kind: "manual_dealer",
      atMs,
      userId: actorId,
      userName: resolveUserName(actorId, d.createdByName, dealerById, { dealerId: d.id }),
      label: `Создал клиента: ${name}`,
      dealerId: d.id,
    });
  }

  for (const ov of Object.values(state.dealerOverridesById)) {
    const t = isoToMs(ov.updatedAt);
    if (t == null) continue;
    const row = dealerById.get(ov.dealerId);
    const name = row?.name ?? ov.dealerId;
    const actorId = actorWithDealerFallback(ov.updatedBy, ov.dealerId, dealerById) || src;
    if (!actorId) {
      pushEv(excludedTechnical, {
        kind: "dealer_updated",
        atMs: t,
        userId: "",
        userName: ACTIVITY_UNKNOWN_DISPLAY,
        label: `Обновил клиента: ${name}`,
        dealerId: ov.dealerId,
      });
      continue;
    }
    pushEv(events, {
      kind: "dealer_updated",
      atMs: t,
      userId: actorId,
      userName: resolveUserName(actorId, ov.updatedByName, dealerById, { dealerId: ov.dealerId }),
      label: `Обновил клиента: ${name}`,
      dealerId: ov.dealerId,
    });
  }

  for (const tp of Object.values(state.manuallyCreatedTradePointsById)) {
    const title =
      strField(tp.fields as Record<string, unknown>, "name") ||
      strField(tp.fields as Record<string, unknown>, "title") ||
      tp.internalCode ||
      tp.id;
    let atMs: number;
    if (src) {
      atMs = resolveManualEntityActivityMs(tp.createdAt, tp.updatedAt, state.updatedAt, { useSnapshotFallback: true });
    } else {
      const t = isoToMs(tp.createdAt);
      if (t == null) continue;
      atMs = t;
    }
    const actorId = normalizeText(tp.createdBy) || actorWithDealerFallback("", tp.dealerId, dealerById) || src;
    if (!actorId) {
      pushEv(excludedTechnical, {
        kind: "manual_trade_point",
        atMs,
        userId: "",
        userName: ACTIVITY_UNKNOWN_DISPLAY,
        label: `Добавил ТТ: ${title}`,
        dealerId: tp.dealerId,
        tradePointId: tp.id,
      });
      continue;
    }
    pushEv(events, {
      kind: "manual_trade_point",
      atMs,
      userId: actorId,
      userName: resolveUserName(actorId, tp.createdByName, dealerById, { dealerId: tp.dealerId }),
      label: `Добавил ТТ: ${title}`,
      dealerId: tp.dealerId,
      tradePointId: tp.id,
    });
  }

  for (const ov of Object.values(state.tradePointOverridesById)) {
    const t = isoToMs(ov.updatedAt);
    if (t == null) continue;
    const actorId = actorWithDealerFallback(ov.updatedBy, ov.dealerId, dealerById) || src;
    if (!actorId) {
      pushEv(excludedTechnical, {
        kind: "trade_point_updated",
        atMs: t,
        userId: "",
        userName: ACTIVITY_UNKNOWN_DISPLAY,
        label: `Обновил торговую точку`,
        dealerId: ov.dealerId,
        tradePointId: ov.tradePointId,
      });
      continue;
    }
    pushEv(events, {
      kind: "trade_point_updated",
      atMs: t,
      userId: actorId,
      userName: resolveUserName(actorId, ov.updatedByName, dealerById, { dealerId: ov.dealerId }),
      label: `Обновил торговую точку`,
      dealerId: ov.dealerId,
      tradePointId: ov.tradePointId,
    });
  }

  for (const ar of Object.values(state.archivedLegalEntitiesById)) {
    const t = isoToMs(ar.archivedAt);
    if (t == null) continue;
    const uidRaw = normalizeText(ar.archivedBy);
    if (!uidRaw || normalizeActorUserId(ar.archivedBy) === ACTIVITY_UNKNOWN_USER_ID) {
      pushEv(excludedTechnical, {
        kind: "archive_legal",
        atMs: t,
        userId: "",
        userName: ACTIVITY_UNKNOWN_DISPLAY,
        label: `Архивировал юрлицо`,
        dealerId: ar.dealerId,
      });
      continue;
    }
    pushEv(events, {
      kind: "archive_legal",
      atMs: t,
      userId: ar.archivedBy,
      userName: resolveUserName(ar.archivedBy, ar.archivedByName, dealerById, { dealerId: ar.dealerId }),
      label: `Архивировал юрлицо`,
      dealerId: ar.dealerId,
    });
  }

  for (const ar of Object.values(state.archivedDealerContactsById)) {
    const t = isoToMs(ar.archivedAt);
    if (t == null) continue;
    const uidRaw = normalizeText(ar.archivedBy);
    if (!uidRaw || normalizeActorUserId(ar.archivedBy) === ACTIVITY_UNKNOWN_USER_ID) {
      pushEv(excludedTechnical, {
        kind: "archive_contact",
        atMs: t,
        userId: "",
        userName: ACTIVITY_UNKNOWN_DISPLAY,
        label: `Архивировал контакт клиента`,
        dealerId: ar.dealerId,
      });
      continue;
    }
    pushEv(events, {
      kind: "archive_contact",
      atMs: t,
      userId: ar.archivedBy,
      userName: resolveUserName(ar.archivedBy, ar.archivedByName, dealerById, { dealerId: ar.dealerId }),
      label: `Архивировал контакт клиента`,
      dealerId: ar.dealerId,
    });
  }

  for (const [dealerId, st] of Object.entries(state.legalEntityOverridesByDealerId)) {
    const ob = st?.overridesById;
    if (!ob) continue;
    for (const raw of Object.values(ob)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const o = raw as Record<string, unknown>;
      const t = isoToMs((o.updatedAt as string) || (o.createdAt as string));
      if (t == null) continue;
      const nm = strField(o, "name") || strField(o, "internalCode") || "Юрлицо";
      const actorRaw = legalEntityActorRaw(o, st) || src;
      if (!actorRaw) {
        pushEv(excludedTechnical, {
          kind: "legal_entity",
          atMs: t,
          userId: "",
          userName: ACTIVITY_UNKNOWN_DISPLAY,
          label: `Юрлицо (нет автора в данных): ${nm}`,
          dealerId,
        });
        continue;
      }
      const byName = normalizeText(o.updatedByName ?? o.createdByName);
      pushEv(events, {
        kind: "legal_entity",
        atMs: t,
        userId: actorRaw,
        userName: resolveUserName(actorRaw, byName || undefined, dealerById, { dealerId }),
        label: `Юрлицо: ${nm}`,
        dealerId,
      });
    }
  }

  for (const [dealerId, photos] of Object.entries(state.dealerPhotosByDealerId)) {
    for (const ph of photos ?? []) {
      if (ph.archivedAt) continue;
      const t = isoToMs(ph.uploadedAt);
      if (t == null) continue;
      const phActor = normalizeText(ph.uploadedBy) || src;
      if (!phActor) {
        pushEv(excludedTechnical, {
          kind: "photo",
          atMs: t,
          userId: "",
          userName: ACTIVITY_UNKNOWN_DISPLAY,
          label: ph.entityType === "dealer" ? `Фото клиента (нет uploadedBy)` : `Фото (нет uploadedBy)`,
          dealerId,
        });
        continue;
      }
      pushEv(events, {
        kind: "photo",
        atMs: t,
        userId: phActor,
        userName: resolveUserName(phActor, ph.uploadedByName, dealerById, { dealerId }),
        label: ph.entityType === "dealer" ? `Загрузил фото клиента` : `Загрузил фото`,
        dealerId,
      });
    }
  }

  for (const [tpId, photos] of Object.entries(state.tradePointPhotosByTradePointId)) {
    for (const ph of photos ?? []) {
      if (ph.archivedAt) continue;
      const t = isoToMs(ph.uploadedAt);
      if (t == null) continue;
      const dealerForTp =
        state.manuallyCreatedTradePointsById[tpId]?.dealerId ?? state.tradePointShowcaseActualizationById[tpId]?.dealerId;
      const phActorTp = normalizeText(ph.uploadedBy) || src;
      if (!phActorTp) {
        pushEv(excludedTechnical, {
          kind: "photo",
          atMs: t,
          userId: "",
          userName: ACTIVITY_UNKNOWN_DISPLAY,
          label: `Фото ТТ (нет uploadedBy)`,
          tradePointId: tpId,
          dealerId: dealerForTp,
        });
        continue;
      }
      pushEv(events, {
        kind: "photo",
        atMs: t,
        userId: phActorTp,
        userName: resolveUserName(phActorTp, ph.uploadedByName, dealerById, { dealerId: dealerForTp }),
        label: `Загрузил фото торговой точки`,
        tradePointId: tpId,
        dealerId: dealerForTp,
      });
    }
  }

  for (const sh of Object.values(state.tradePointShowcaseActualizationById)) {
    const t = isoToMs(sh.updatedAt);
    if (t == null) continue;
    const filled =
      sh.hasShowcase === true &&
      ((sh.selectedShowcaseModels?.length ?? 0) > 0 ||
        sh.totalPortals != null ||
        sh.entrancePortals != null ||
        sh.interiorPortals != null);
    if (!filled) continue;
    const shActor = normalizeText(sh.updatedBy) || src;
    if (!shActor) {
      pushEv(excludedTechnical, {
        kind: "showcase",
        atMs: t,
        userId: "",
        userName: ACTIVITY_UNKNOWN_DISPLAY,
        label: `Витрина ТТ (нет updatedBy)`,
        dealerId: sh.dealerId,
        tradePointId: sh.tradePointId,
      });
      continue;
    }
    pushEv(events, {
      kind: "showcase",
      atMs: t,
      userId: shActor,
      userName: resolveUserName(shActor, sh.updatedByName, dealerById, { dealerId: sh.dealerId }),
      label: `Заполнил витрину ТТ`,
      dealerId: sh.dealerId,
      tradePointId: sh.tradePointId,
    });
  }

  for (const c of Object.values(state.dealerActualizationContactsById)) {
    const t = isoToMs(c.updatedAt) ?? isoToMs(c.createdAt);
    if (t == null) continue;
    const uid = normalizeText(c.updatedBy) || src;
    if (!uid) continue;
    pushEv(events, {
      kind: "contact",
      atMs: t,
      userId: uid,
      userName: resolveUserName(uid, c.updatedByName, dealerById, { dealerId: c.dealerId }),
      label: `Контакт клиента: ${c.fullName || "без имени"}`,
      dealerId: c.dealerId,
    });
  }

  for (const sh of Object.values(state.tradePointShowcaseActualizationById)) {
    const tasks = sh.showcaseMatrixTasks ?? [];
    for (const task of tasks) {
      const t = isoToMs(task.createdAt);
      if (t == null) continue;
      const taskActor = normalizeText(task.createdBy) || src;
      if (!taskActor) {
        pushEv(excludedTechnical, {
          kind: "matrix_task",
          atMs: t,
          userId: "",
          userName: ACTIVITY_UNKNOWN_DISPLAY,
          label: `Задача по матрице: ${normalizeText(task.productName) || "без названия"}`,
          dealerId: task.dealerId,
          tradePointId: task.tradePointId,
        });
        continue;
      }
      pushEv(events, {
        kind: "matrix_task",
        atMs: t,
        userId: taskActor,
        userName: resolveUserName(taskActor, task.createdByName, dealerById, { dealerId: task.dealerId }),
        label: `Задача по матрице: ${normalizeText(task.productName) || "без названия"}`,
        dealerId: task.dealerId,
        tradePointId: task.tradePointId,
      });
    }
  }

  events.sort((a, b) => b.atMs - a.atMs);
  excludedTechnical.sort((a, b) => b.atMs - a.atMs);
  return { events, excludedTechnical };
}

export type ActivitySourceSnapshot = { userId: string; state: ActualizationState };

/** Диагностика источников для дашборда активности и team context. */
export type ActivityDataSourcesDiagnostics = {
  mode: "self" | "team";
  requestedUserIds: string[];
  loadedSnapshots: number;
  failedSnapshots: number;
  emptySnapshots: number;
  sumManualDealersAcrossSources: number;
  mergedManualDealers: number;
  mergedManualTradePoints: number;
  lastMergedUpdatedAt: string | null;
};

/** Сбор событий по каждому снимку state с атрибуцией владельцу userId (РОП / директор). */
export function collectActivityBucketsFromSources(sources: ActivitySourceSnapshot[], dealerRows: DealerRow[]): ActivityCollection {
  const events: ActivityEvent[] = [];
  const excludedTechnical: ActivityEvent[] = [];
  for (const { userId, state } of sources) {
    const uid = normalizeText(userId);
    if (!uid) continue;
    const bucket = collectActivityBuckets(state, dealerRows, { activitySourceUserId: uid });
    events.push(...bucket.events);
    excludedTechnical.push(...bucket.excludedTechnical);
  }
  events.sort((a, b) => b.atMs - a.atMs);
  excludedTechnical.sort((a, b) => b.atMs - a.atMs);
  return { events, excludedTechnical };
}

/** События для обратной совместимости; для excludedTechnical см. collectActivityBuckets. */
export function collectActivityEvents(state: ActualizationState, dealerRows: DealerRow[]): ActivityEvent[] {
  return collectActivityBuckets(state, dealerRows).events;
}

export function eventMatchesActivityTypeFilter(ev: ActivityEvent, f: ActivityTypeFilter): boolean {
  if (f === "all") return true;
  if (f === "dealers") return ev.kind === "manual_dealer" || ev.kind === "dealer_updated";
  if (f === "trade_points") return ev.kind === "manual_trade_point" || ev.kind === "trade_point_updated";
  if (f === "legal") return ev.kind === "legal_entity" || ev.kind === "archive_legal";
  if (f === "photos") return ev.kind === "photo";
  if (f === "showcase") return ev.kind === "showcase" || ev.kind === "matrix_task";
  if (f === "archive") return ev.kind.startsWith("archive_");
  return true;
}

export function resolvedEventDealerId(ev: ActivityEvent, act: ActualizationState): string | undefined {
  if (ev.dealerId) return ev.dealerId;
  if (!ev.tradePointId) return undefined;
  const tpId = ev.tradePointId;
  const m = act.manuallyCreatedTradePointsById[tpId];
  if (m) return m.dealerId;
  const sh = act.tradePointShowcaseActualizationById[tpId];
  if (sh) return sh.dealerId;
  for (const o of Object.values(act.tradePointOverridesById)) {
    if (o.tradePointId === tpId) return o.dealerId;
  }
  return undefined;
}

export function filterEventsForDashboard(
  events: ActivityEvent[],
  range: { startMs: number; endMs: number } | null,
  typeFilter: ActivityTypeFilter,
  opts: {
    act: ActualizationState;
    scopedDealerIds: Set<string>;
    ropTeamId: string | "__all__";
    managerId: string | "__all__";
    regionalManager: string | "__all__";
    city: string | "__all__";
    dealerById: Map<string, DealerRow>;
  },
): ActivityEvent[] {
  return events.filter((ev) => {
    if (!inActivityRange(ev.atMs, range)) return false;
    if (!eventMatchesActivityTypeFilter(ev, typeFilter)) return false;
    const dealerId = resolvedEventDealerId(ev, opts.act);
    if (dealerId && !opts.scopedDealerIds.has(dealerId)) return false;
    if (opts.ropTeamId !== "__all__") {
      const row = dealerId ? opts.dealerById.get(dealerId) : undefined;
      if (row && row.releaseTeamId !== opts.ropTeamId) return false;
    }
    if (opts.managerId !== "__all__") {
      if (ev.userId !== opts.managerId) {
        const row = dealerId ? opts.dealerById.get(dealerId) : undefined;
        if (!row || row.releaseManagerId !== opts.managerId) return false;
      }
    }
    if (opts.regionalManager !== "__all__") {
      const row = dealerId ? opts.dealerById.get(dealerId) : undefined;
      const rm = row ? getDealerRegionalManagerDisplay(row) : "";
      if (rm !== opts.regionalManager) return false;
    }
    if (opts.city !== "__all__") {
      const row = dealerId ? opts.dealerById.get(dealerId) : undefined;
      if (!row || row.city !== opts.city) return false;
    }
    return true;
  });
}

export type ManagerActivityAgg = {
  managerId: string;
  displayName: string;
  teamLabel: string;
  createdDealers: number;
  updatedDealers: number;
  addedTradePoints: number;
  updatedTradePoints: number;
  legalEntities: number;
  photos: number;
  showcases: number;
  archives: number;
  contacts: number;
  totalActions: number;
  score: number;
  lastAtMs: number;
};

/** Подпись для графиков: неизвестный автор — единая формулировка. */
export function activityChartManagerLabel(row: ManagerActivityAgg): string {
  return isActivityUnknownUserId(row.managerId) ? ACTIVITY_UNKNOWN_DISPLAY : row.displayName;
}

const SCORE: Partial<Record<ActivityEventKind, number>> = {
  manual_dealer: 3,
  dealer_updated: 2,
  manual_trade_point: 2,
  trade_point_updated: 1,
  legal_entity: 2,
  contact: 1,
  photo: 1,
  showcase: 2,
  archive_legal: 1,
  archive_contact: 1,
  matrix_task: 1,
};

function bumpScore(kind: ActivityEventKind): number {
  return SCORE[kind] ?? 1;
}

export function aggregateByManager(events: ActivityEvent[], roster: SalesUser[]): ManagerActivityAgg[] {
  const byUser = new Map<string, ManagerActivityAgg>();

  const ensure = (id: string, name: string) => {
    let a = byUser.get(id);
    if (!a) {
      const u = getSalesUserById(id);
      const team = u?.teamId ? `Команда ${u.teamId}` : "—";
      a = {
        managerId: id,
        displayName: u?.name ?? name,
        teamLabel: team,
        createdDealers: 0,
        updatedDealers: 0,
        addedTradePoints: 0,
        updatedTradePoints: 0,
        legalEntities: 0,
        photos: 0,
        showcases: 0,
        archives: 0,
        contacts: 0,
        totalActions: 0,
        score: 0,
        lastAtMs: 0,
      };
      byUser.set(id, a);
    }
    return a;
  };

  for (const m of roster) {
    ensure(m.id, m.name);
  }

  for (const ev of events) {
    const a = ensure(ev.userId, ev.userName);
    a.displayName = ev.userName || a.displayName;
    a.totalActions += 1;
    a.score += bumpScore(ev.kind);
    if (ev.atMs !== ACTIVITY_NO_CALENDAR_TIME_MS) {
      a.lastAtMs = Math.max(a.lastAtMs, ev.atMs);
    }
    switch (ev.kind) {
      case "manual_dealer":
        a.createdDealers += 1;
        break;
      case "dealer_updated":
        a.updatedDealers += 1;
        break;
      case "manual_trade_point":
        a.addedTradePoints += 1;
        break;
      case "trade_point_updated":
        a.updatedTradePoints += 1;
        break;
      case "legal_entity":
        a.legalEntities += 1;
        break;
      case "photo":
        a.photos += 1;
        break;
      case "showcase":
        a.showcases += 1;
        break;
      case "archive_legal":
      case "archive_contact":
        a.archives += 1;
        break;
      case "contact":
        a.contacts += 1;
        break;
      case "matrix_task":
        break;
      default:
        break;
    }
  }

  return Array.from(byUser.values()).sort(
    (x, y) =>
      y.createdDealers - x.createdDealers ||
      y.addedTradePoints - x.addedTradePoints ||
      y.lastAtMs - x.lastAtMs ||
      y.score - x.score,
  );
}

export function activityStatusForManager(row: ManagerActivityAgg): "active" | "weak" | "none" {
  if (row.totalActions === 0) return "none";
  const twoDaysAgo = Date.now() - 2 * 86400000;
  if (row.lastAtMs >= twoDaysAgo) return "active";
  return "weak";
}

export type DayBucket = {
  day: string;
  dealers: number;
  tradePoints: number;
  legal: number;
  photos: number;
  showcase: number;
};

export function bucketEventsByDay(events: ActivityEvent[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const ev of events) {
    if (ev.atMs === ACTIVITY_NO_CALENDAR_TIME_MS) continue;
    const d = new Date(ev.atMs);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let b = map.get(key);
    if (!b) {
      b = { day: key, dealers: 0, tradePoints: 0, legal: 0, photos: 0, showcase: 0 };
      map.set(key, b);
    }
    if (ev.kind === "manual_dealer" || ev.kind === "dealer_updated") b.dealers += 1;
    else if (ev.kind === "manual_trade_point" || ev.kind === "trade_point_updated") b.tradePoints += 1;
    else if (ev.kind === "legal_entity") b.legal += 1;
    else if (ev.kind === "photo") b.photos += 1;
    else if (ev.kind === "showcase" || ev.kind === "matrix_task") b.showcase += 1;
  }
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
}

export type KpiTop = {
  manualDealers: number;
  updatedDealers: number;
  manualTradePoints: number;
  legalTouches: number;
  photos: number;
  showcasesFilled: number;
  deficitTradePoints: number;
  openMatrixTasks: number;
  activeManagers: number;
};

/** Область строк клиентской базы для KPI (совпадает с фильтрами роли на дашборде). */
export type ActivityDashboardKpiScope = {
  scopedDealerIds: Set<string>;
};

export type ComputeTopKpisOptions = {
  /** События с типом «все», уже отфильтрованы по периоду и географии дашборда. */
  kpiBaseEvents?: ActivityEvent[];
};

export function computeTopKpis(
  state: ActualizationState,
  profile: ReleaseDemoProfile,
  range: { startMs: number; endMs: number } | null,
  managerAggs: ManagerActivityAgg[],
  kpiScope: ActivityDashboardKpiScope,
  options?: ComputeTopKpisOptions,
): KpiTop {
  const inScope = (dealerId: string | undefined): boolean => {
    const id = normalizeText(dealerId);
    if (!id) return false;
    return kpiScope.scopedDealerIds.has(id);
  };

  let manualDealers = 0;
  let updatedDealers = 0;
  let manualTradePoints = 0;
  let legalTouches = 0;
  let photos = 0;

  const fromEv = options?.kpiBaseEvents;
  if (fromEv != null) {
    const md = new Set<string>();
    const ud = new Set<string>();
    const mtp = new Set<string>();
    for (const e of fromEv) {
      const dealerId = resolvedEventDealerId(e, state) ?? e.dealerId;
      const did = normalizeText(dealerId);
      if (!did || !inScope(did)) continue;
      if (e.kind === "manual_dealer" && !state.trashedDealersById?.[did]) md.add(did);
      else if (e.kind === "dealer_updated") ud.add(did);
      else if (
        e.kind === "manual_trade_point" &&
        e.tradePointId &&
        !state.trashedDealersById?.[did] &&
        !state.trashedTradePointsById?.[e.tradePointId]
      ) {
        mtp.add(e.tradePointId);
      } else if (e.kind === "legal_entity") {
        legalTouches += 1;
      } else if (e.kind === "photo") {
        photos += 1;
      }
    }
    manualDealers = md.size;
    updatedDealers = ud.size;
    manualTradePoints = mtp.size;
  } else {
    for (const d of Object.values(state.manuallyCreatedDealersById)) {
      if (!inScope(d.id)) continue;
      if (state.trashedDealersById?.[d.id]) continue;
      const t = firstResolvedActivityMs(d.createdAt, d.updatedAt);
      if (t == null) {
        if (range != null) continue;
        manualDealers += 1;
      } else if (inActivityRange(t, range)) {
        manualDealers += 1;
      }
    }
    for (const ov of Object.values(state.dealerOverridesById)) {
      if (!inScope(ov.dealerId)) continue;
      const t = isoToMs(ov.updatedAt);
      if (t != null && inActivityRange(t, range)) updatedDealers += 1;
    }
    for (const tp of Object.values(state.manuallyCreatedTradePointsById)) {
      if (!inScope(tp.dealerId)) continue;
      if (state.trashedDealersById?.[tp.dealerId]) continue;
      if (state.trashedTradePointsById?.[tp.id]) continue;
      const t = firstResolvedActivityMs(tp.createdAt, tp.updatedAt);
      if (t == null) {
        if (range != null) continue;
        manualTradePoints += 1;
      } else if (inActivityRange(t, range)) {
        manualTradePoints += 1;
      }
    }
    for (const [dealerId, st] of Object.entries(state.legalEntityOverridesByDealerId)) {
      if (!inScope(dealerId)) continue;
      for (const raw of Object.values(st?.overridesById ?? {})) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const o = raw as Record<string, unknown>;
        if (!legalEntityActorRaw(o, st)) continue;
        const t = isoToMs((o.updatedAt as string) || (o.createdAt as string));
        if (t != null && inActivityRange(t, range)) legalTouches += 1;
      }
    }
    for (const [dealerId, list] of Object.entries(state.dealerPhotosByDealerId)) {
      if (!inScope(dealerId)) continue;
      for (const ph of list ?? []) {
        if (ph.archivedAt) continue;
        const t = isoToMs(ph.uploadedAt);
        if (t != null && inActivityRange(t, range)) photos += 1;
      }
    }
    for (const [tpId, list] of Object.entries(state.tradePointPhotosByTradePointId)) {
      for (const ph of list ?? []) {
        if (ph.archivedAt) continue;
        const t = isoToMs(ph.uploadedAt);
        if (t == null || !inActivityRange(t, range)) continue;
        const dealerForTp =
          state.manuallyCreatedTradePointsById[tpId]?.dealerId ?? state.tradePointShowcaseActualizationById[tpId]?.dealerId;
        if (!inScope(dealerForTp)) continue;
        photos += 1;
      }
    }
  }

  const tpRows = buildTradePointListForActualization(state, profile, { includeArchivedTradePoints: false });
  let showcasesFilled = 0;
  let deficitTradePoints = 0;
  for (const r of tpRows) {
    if (!inScope(r.dealerId)) continue;
    if (r.showcaseBucket === "has_showcase") {
      const tShow = isoToMs(r.showcaseUpdatedAt);
      if (!range || (tShow != null && inActivityRange(tShow, range))) showcasesFilled += 1;
    }
    if (r.matrixDeficitCount > 0) deficitTradePoints += 1;
  }

  let openMatrixTasks = 0;
  for (const sh of Object.values(state.tradePointShowcaseActualizationById)) {
    if (!inScope(sh.dealerId)) continue;
    for (const t of sh.showcaseMatrixTasks ?? []) {
      if (t.status === "new") openMatrixTasks += 1;
    }
  }

  const meaningfulTouches = (m: ManagerActivityAgg) =>
    m.updatedDealers + m.updatedTradePoints + m.legalEntities + m.photos + m.showcases + m.contacts;
  const activeManagers = managerAggs.filter(
    (m) => m.createdDealers > 0 || m.addedTradePoints > 0 || meaningfulTouches(m) > 0,
  ).length;

  return {
    manualDealers,
    updatedDealers,
    manualTradePoints,
    legalTouches,
    photos,
    showcasesFilled,
    deficitTradePoints,
    openMatrixTasks,
    activeManagers,
  };
}

export type QualityMetrics = {
  dealersWithInnPct: number;
  dealersWithPhonePct: number;
  dealersWithEmailPct: number;
  dealersWithLegalPct: number;
  dealersWithTpPct: number;
  tradePointsWithAddressPct: number;
  tradePointsWithPhotoPct: number;
  tradePointsShowcaseFilledPct: number;
};

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((100 * n) / d);
}

export function computeQualityMetrics(state: ActualizationState, profile: ReleaseDemoProfile, dealerRows: DealerRow[]): QualityMetrics {
  const rows = dealerRows.filter((r) => !r.id.startsWith("archived-"));
  const dTot = rows.length;
  let dInn = 0;
  let dPhone = 0;
  let dEmail = 0;
  let dLegal = 0;
  let dTp = 0;
  for (const r of rows) {
    const inn = (r.actualizationInn ?? "").replace(/\D/g, "");
    if (inn.length >= 10) dInn += 1;
    const ph = normalizeText(r.contacts?.phone);
    if (ph && ph !== "—") dPhone += 1;
    const em = normalizeText(r.contacts?.email);
    if (em && em.includes("@")) dEmail += 1;
    const le = mergeLegalEntitiesForActualization(r, state).length > 0;
    if (le) dLegal += 1;
    const tps = mergeTradePointsActiveForActualization(r, state);
    if (tps.length > 0) dTp += 1;
  }

  const tpRows = buildTradePointListForActualization(state, profile, { includeArchivedTradePoints: false });
  const tpTot = tpRows.length;
  let tpAddr = 0;
  let tpPhoto = 0;
  let tpShow = 0;
  for (const r of tpRows) {
    const a = normalizeText(r.address);
    const c = normalizeText(r.city);
    if (a && a !== "—" && c && c !== "—") tpAddr += 1;
    const cover = normalizeText(r.point.coverPhotoUrl) || normalizeText(r.point.coverPhotoThumbnailUrl);
    if (cover) tpPhoto += 1;
    if (r.showcaseBucket === "has_showcase") tpShow += 1;
  }

  return {
    dealersWithInnPct: pct(dInn, dTot),
    dealersWithPhonePct: pct(dPhone, dTot),
    dealersWithEmailPct: pct(dEmail, dTot),
    dealersWithLegalPct: pct(dLegal, dTot),
    dealersWithTpPct: pct(dTp, dTot),
    tradePointsWithAddressPct: pct(tpAddr, tpTot),
    tradePointsWithPhotoPct: pct(tpPhoto, tpTot),
    tradePointsShowcaseFilledPct: pct(tpShow, tpTot),
  };
}

export type ContributionAddedClientRow = {
  dealerId: string;
  title: string;
  city: string;
  inn: string;
  savedAtLabel: string;
  tradePointCount: number;
  hasExplicitDate: boolean;
  activitySortMs: number;
};

export type ContributionAddedTradePointRow = {
  tradePointId: string;
  dealerId: string;
  tpTitle: string;
  dealerTitle: string;
  city: string;
  address: string;
  phone: string;
  savedAtLabel: string;
  hasExplicitDate: boolean;
  activitySortMs: number;
};

/** Фильтры дашборда без выбора конкретного менеджера (для списков в диалоге вкладок). */
export type DashboardGeoFilterPack = {
  act: ActualizationState;
  scopedDealerIds: Set<string>;
  ropTeamId: string | "__all__";
  regionalManager: string | "__all__";
  city: string | "__all__";
  dealerById: Map<string, DealerRow>;
};

export function passesContributionGeoFilters(
  dealerId: string,
  pack: DashboardGeoFilterPack,
  manualCityFallback?: string,
): boolean {
  if (!pack.scopedDealerIds.has(dealerId)) return false;
  if (pack.act.trashedDealersById?.[dealerId]) return false;
  if (pack.ropTeamId !== "__all__") {
    const row = pack.dealerById.get(dealerId);
    if (row && row.releaseTeamId !== pack.ropTeamId) return false;
  }
  if (pack.regionalManager !== "__all__") {
    const row = pack.dealerById.get(dealerId);
    const rm = row ? getDealerRegionalManagerDisplay(row) : "";
    if (rm !== pack.regionalManager) return false;
  }
  if (pack.city !== "__all__") {
    const row = pack.dealerById.get(dealerId);
    const cRow = row?.city;
    const c = normalizeText(cRow || manualCityFallback);
    if (c !== pack.city) return false;
  }
  return true;
}

/**
 * Фильтры для ручных записей из снимков state: **без** scoped dealer base и **без** архивов —
 * считаем все id из `manuallyCreated*`, иначе KPI не совпадают с диагностикой merged manual.
 * РОП/РМ/город применяются только там, где это можно вывести из строки клиента или полей формы.
 */
export function passesManualCreatedRecordDashboardFilters(
  dealerId: string,
  pack: DashboardGeoFilterPack,
  manualCityFallback?: string,
): boolean {
  if (pack.ropTeamId !== "__all__") {
    const row = pack.dealerById.get(dealerId);
    if (row && row.releaseTeamId !== pack.ropTeamId) return false;
  }
  if (pack.regionalManager !== "__all__") {
    const row = pack.dealerById.get(dealerId);
    if (row) {
      const rm = getDealerRegionalManagerDisplay(row);
      if (rm !== pack.regionalManager) return false;
    }
  }
  if (pack.city !== "__all__") {
    const row = pack.dealerById.get(dealerId);
    const cRow = row?.city;
    const c = normalizeText(cRow || manualCityFallback);
    if (c !== pack.city) return false;
  }
  return true;
}

function activitySourceOwnerAllowedForRopTeam(ownerId: string, ropTeamId: string | "__all__"): boolean {
  if (isRopOrManagerAllFilter(ropTeamId)) return true;
  const u = getAllSalesManagers().find((m) => m.id === ownerId);
  if (!u) return true;
  return u.teamId === ropTeamId;
}

export type ManagerCreatedSummaryRow = {
  managerId: string;
  displayName: string;
  /** Название команды (без РОП) для колонки «Команда». */
  teamName: string;
  newClients: number;
  newTradePoints: number;
  total: number;
  /** Максимальная известная дата добавления (0 = нет дат). */
  lastAddedAtMs: number;
};

export function managerTeamNameOnly(managerId: string): string {
  const u = getSalesUserById(managerId);
  if (!u?.teamId) return "—";
  return getTeamById(u.teamId)?.name ?? u.teamId;
}

/**
 * Подсчёт **новых** ручных клиентов и ТТ напрямую из `activitySources` (`manuallyCreated*`), без score и без
 * привязки к scoped dealer base / архивам. Автор записи = `source.userId` (владелец снимка state).
 * Период: «Всё время» — все записи, в т.ч. без даты; иначе только с датой в диапазоне.
 */
export function computeManagerCreatedSummary(
  sources: ActivitySourceSnapshot[],
  pack: DashboardGeoFilterPack,
  range: { startMs: number; endMs: number } | null,
  roster: SalesUser[],
  managerFilter: string | "__all__",
): ManagerCreatedSummaryRow[] {
  const byId = new Map<string, ManagerCreatedSummaryRow>();

  const ensure = (id: string): ManagerCreatedSummaryRow => {
    let r = byId.get(id);
    if (!r) {
      const u = getSalesUserById(id);
      r = {
        managerId: id,
        displayName: u?.name ?? id,
        teamName: managerTeamNameOnly(id),
        newClients: 0,
        newTradePoints: 0,
        total: 0,
        lastAddedAtMs: 0,
      };
      byId.set(id, r);
    }
    return r;
  };

  for (const m of roster) {
    ensure(m.id);
  }

  for (const { userId, state: st } of sources) {
    const owner = normalizeText(userId);
    if (!owner) continue;
    if (!activitySourceOwnerAllowedForRopTeam(owner, pack.ropTeamId)) continue;
    if (managerFilter !== "__all__" && owner !== managerFilter) continue;
    const row = ensure(owner);

    for (const d of Object.values(st.manuallyCreatedDealersById)) {
      const f = (d.fields ?? {}) as Record<string, unknown>;
      const cityMan = strField(f, "city");
      if (!passesManualCreatedRecordDashboardFilters(d.id, pack, cityMan)) continue;
      const atMs = resolveManualEntityActivityMs(d.createdAt, d.updatedAt, st.updatedAt, { useSnapshotFallback: true });
      if (!inActivityRange(atMs, range)) continue;
      row.newClients += 1;
      row.total += 1;
      if (atMs !== ACTIVITY_NO_CALENDAR_TIME_MS) {
        row.lastAddedAtMs = Math.max(row.lastAddedAtMs, atMs);
      }
    }

    for (const tp of Object.values(st.manuallyCreatedTradePointsById)) {
      const f = (tp.fields ?? {}) as Record<string, unknown>;
      const cityMan = strField(f, "city");
      if (!passesManualCreatedRecordDashboardFilters(tp.dealerId, pack, cityMan)) continue;
      const atMs = resolveManualEntityActivityMs(tp.createdAt, tp.updatedAt, st.updatedAt, { useSnapshotFallback: true });
      if (!inActivityRange(atMs, range)) continue;
      row.newTradePoints += 1;
      row.total += 1;
      if (atMs !== ACTIVITY_NO_CALENDAR_TIME_MS) {
        row.lastAddedAtMs = Math.max(row.lastAddedAtMs, atMs);
      }
    }
  }

  const rows = Array.from(byId.values()).filter((r) => managerFilter === "__all__" || r.managerId === managerFilter);

  rows.sort((a, b) => {
    const ta = a.newClients + a.newTradePoints;
    const tb = b.newClients + b.newTradePoints;
    if (tb !== ta) return tb - ta;
    if (b.newClients !== a.newClients) return b.newClients - a.newClients;
    if (b.newTradePoints !== a.newTradePoints) return b.newTradePoints - a.newTradePoints;
    return b.lastAddedAtMs - a.lastAddedAtMs;
  });

  return rows;
}

export function listContributionAddedClientsForManager(
  managerId: string,
  sources: ActivitySourceSnapshot[],
  pack: DashboardGeoFilterPack,
  range: { startMs: number; endMs: number } | null,
): ContributionAddedClientRow[] {
  const uid = normalizeText(managerId);
  const snap = sources.find((s) => normalizeText(s.userId) === uid);
  if (!snap) return [];
  const st = snap.state;
  const out: ContributionAddedClientRow[] = [];
  for (const d of Object.values(st.manuallyCreatedDealersById)) {
    const f = (d.fields ?? {}) as Record<string, unknown>;
    const cityMan = strField(f, "city");
    if (!passesManualCreatedRecordDashboardFilters(d.id, pack, cityMan)) continue;
    const atMs = resolveManualEntityActivityMs(d.createdAt, d.updatedAt, st.updatedAt, { useSnapshotFallback: true });
    if (!inActivityRange(atMs, range)) continue;
    const row = pack.dealerById.get(d.id);
    const title = strField(f, "name") || row?.name || d.internalCode || d.id;
    const city = normalizeText(row?.city) || cityMan || "—";
    const inn = normalizeText(strField(f, "inn")) || normalizeText(row?.actualizationInn) || "—";
    const tpCount = Object.values(st.manuallyCreatedTradePointsById).filter((tp) => tp.dealerId === d.id).length;
    const label =
      atMs === ACTIVITY_NO_CALENDAR_TIME_MS ? "Дата не указана" : new Date(atMs).toLocaleString("ru-RU");
    out.push({
      dealerId: d.id,
      title,
      city,
      inn,
      savedAtLabel: label,
      tradePointCount: tpCount,
      hasExplicitDate: atMs !== ACTIVITY_NO_CALENDAR_TIME_MS,
      activitySortMs: atMs === ACTIVITY_NO_CALENDAR_TIME_MS ? 0 : atMs,
    });
  }
  return out.sort((a, b) => b.activitySortMs - a.activitySortMs || a.title.localeCompare(b.title, "ru"));
}

export function listContributionAddedTradePointsForManager(
  managerId: string,
  sources: ActivitySourceSnapshot[],
  pack: DashboardGeoFilterPack,
  range: { startMs: number; endMs: number } | null,
): ContributionAddedTradePointRow[] {
  const uid = normalizeText(managerId);
  const snap = sources.find((s) => normalizeText(s.userId) === uid);
  if (!snap) return [];
  const st = snap.state;
  const out: ContributionAddedTradePointRow[] = [];
  for (const tp of Object.values(st.manuallyCreatedTradePointsById)) {
    const f = (tp.fields ?? {}) as Record<string, unknown>;
    const cityMan = strField(f, "city");
    if (!passesManualCreatedRecordDashboardFilters(tp.dealerId, pack, cityMan)) continue;
    const atMs = resolveManualEntityActivityMs(tp.createdAt, tp.updatedAt, st.updatedAt, { useSnapshotFallback: true });
    if (!inActivityRange(atMs, range)) continue;
    const row = pack.dealerById.get(tp.dealerId);
    const tpTitle = strField(f, "name") || strField(f, "title") || tp.internalCode || tp.id;
    const dealerTitle = row?.name ?? tp.dealerId;
    const city = normalizeText(row?.city) || cityMan || "—";
    const address = strField(f, "address") || "—";
    const phone = strField(f, "contactPhone") || strField(f, "phone") || "—";
    const label =
      atMs === ACTIVITY_NO_CALENDAR_TIME_MS ? "Дата не указана" : new Date(atMs).toLocaleString("ru-RU");
    out.push({
      tradePointId: tp.id,
      dealerId: tp.dealerId,
      tpTitle,
      dealerTitle,
      city,
      address,
      phone,
      savedAtLabel: label,
      hasExplicitDate: atMs !== ACTIVITY_NO_CALENDAR_TIME_MS,
      activitySortMs: atMs === ACTIVITY_NO_CALENDAR_TIME_MS ? 0 : atMs,
    });
  }
  return out.sort((a, b) => b.activitySortMs - a.activitySortMs || a.tpTitle.localeCompare(b.tpTitle, "ru"));
}

export function managerTeamAndRopLabel(managerId: string): string {
  const u = getSalesUserById(managerId);
  if (!u?.teamId) return "—";
  const team = getTeamById(u.teamId);
  const tl = getTeamLeadForTeam(u.teamId);
  const teamPart = team?.name ?? u.teamId;
  const rop = tl?.name ? `РОП: ${tl.name}` : "";
  return rop ? `${teamPart} · ${rop}` : teamPart;
}

export type ProblemLine = { id: string; severity: "info"; text: string };

export function computeProblemLines(state: ActualizationState, profile: ReleaseDemoProfile, dealerRows: DealerRow[]): ProblemLine[] {
  const lines: ProblemLine[] = [];
  const scoped = dealerRows.filter((r) => !r.id.startsWith("archived-"));

  for (const r of scoped) {
    const inn = (r.actualizationInn ?? "").replace(/\D/g, "");
    if (inn.length < 10) lines.push({ id: `inn-${r.id}`, severity: "info", text: `Клиент без ИНН: ${r.name}` });
  }

  for (const r of scoped) {
    const tps = mergeTradePointsActiveForActualization(r, state);
    if (tps.length === 0) lines.push({ id: `notp-${r.id}`, severity: "info", text: `Клиент без ТТ: ${r.name}` });
  }

  const tpRows = buildTradePointListForActualization(state, profile, { includeArchivedTradePoints: false });
  for (const r of tpRows.slice(0, 200)) {
    const a = normalizeText(r.address);
    const c = normalizeText(r.city);
    if (!a || a === "—" || !c || c === "—") lines.push({ id: `addr-${r.tradePointId}`, severity: "info", text: `ТТ без адреса: ${normalizeText(r.tradePointName) || "ТТ"}` });
    const phone = normalizeText(r.point.contactPhone);
    if (!phone || phone === "—") lines.push({ id: `ph-${r.tradePointId}`, severity: "info", text: `ТТ без контакта: ${normalizeText(r.tradePointName) || "ТТ"}` });
    const cover = normalizeText(r.point.coverPhotoUrl) || normalizeText(r.point.coverPhotoThumbnailUrl);
    if (!cover) lines.push({ id: `pic-${r.tradePointId}`, severity: "info", text: `ТТ без фото: ${normalizeText(r.tradePointName) || "ТТ"}` });
    if (r.hasShowcase === true && r.showcaseBucket !== "has_showcase") {
      lines.push({ id: `sh-${r.tradePointId}`, severity: "info", text: `ТТ с витриной, но данные не заполнены: ${normalizeText(r.tradePointName) || "ТТ"}` });
    }
    if (r.matrixDeficitCount > 0) lines.push({ id: `def-${r.tradePointId}`, severity: "info", text: `Дефицит матрицы: ${normalizeText(r.tradePointName) || "ТТ"} (${r.matrixDeficitCount})` });
  }

  return lines.slice(0, 80);
}
