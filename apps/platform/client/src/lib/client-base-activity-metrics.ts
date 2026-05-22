/**
 * Метрики и псевдо-события дашборда «Актуализация базы» из ActualizationState.
 * Атрибуция действий — по полям createdBy / updatedBy / archivedBy / uploadedBy и *Name.
 */

import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerRegionalManagerDisplay } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getSalesUserById, type SalesUser } from "@/lib/sales-control-data";
import { mergeLegalEntitiesForActualization, mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import { buildTradePointListForActualization } from "@/lib/trade-point-list-for-actualization";

/** Безопасная нормализация текста из API/состояния (undefined, не-строки). */
export function normalizeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
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
  | "archive_dealer"
  | "archive_trade_point"
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
  return atMs >= range.startMs && atMs < range.endMs;
}

function resolveUserName(userId: string | undefined | null, explicitName: string | undefined, dealerById: Map<string, DealerRow>): string {
  const ex = normalizeText(explicitName);
  if (ex && ex !== "—") return ex;
  const uid = normalizeText(userId);
  const u = getSalesUserById(uid);
  if (normalizeText(u?.name)) return normalizeText(u?.name);
  for (const row of Array.from(dealerById.values())) {
    if (row.releaseManagerId === uid && normalizeText(row.manager)) return normalizeText(row.manager);
  }
  if (uid) return uid;
  return "Не определён";
}

function pushEv(out: ActivityEvent[], e: Omit<ActivityEvent, "id"> & { id?: string }) {
  const userId = normalizeText(e.userId) || "__unset__";
  const userName = normalizeText(e.userName) || "Не определён";
  const id = e.id ?? `${e.kind}-${e.atMs}-${userId}-${Math.random().toString(36).slice(2, 8)}`;
  out.push({ ...e, id, userId, userName });
}

function strField(o: Record<string, unknown>, k: string): string {
  return normalizeText(o[k]);
}

export function collectActivityEvents(state: ActualizationState, dealerRows: DealerRow[]): ActivityEvent[] {
  const dealerById = new Map(dealerRows.map((r) => [r.id, r]));
  const out: ActivityEvent[] = [];

  for (const d of Object.values(state.manuallyCreatedDealersById)) {
    const t = isoToMs(d.createdAt);
    if (t == null) continue;
    const name = strField(d.fields as Record<string, unknown>, "name") || d.internalCode || d.id;
    pushEv(out, {
      kind: "manual_dealer",
      atMs: t,
      userId: d.createdBy,
      userName: resolveUserName(d.createdBy, d.createdByName, dealerById),
      label: `Создал клиента: ${name}`,
      dealerId: d.id,
    });
  }

  for (const ov of Object.values(state.dealerOverridesById)) {
    const t = isoToMs(ov.updatedAt);
    if (t == null) continue;
    const row = dealerById.get(ov.dealerId);
    const name = row?.name ?? ov.dealerId;
    pushEv(out, {
      kind: "dealer_updated",
      atMs: t,
      userId: ov.updatedBy,
      userName: resolveUserName(ov.updatedBy, ov.updatedByName, dealerById),
      label: `Обновил клиента: ${name}`,
      dealerId: ov.dealerId,
    });
  }

  for (const tp of Object.values(state.manuallyCreatedTradePointsById)) {
    const t = isoToMs(tp.createdAt);
    if (t == null) continue;
    const title = strField(tp.fields as Record<string, unknown>, "name") || strField(tp.fields as Record<string, unknown>, "title") || tp.internalCode || tp.id;
    pushEv(out, {
      kind: "manual_trade_point",
      atMs: t,
      userId: tp.createdBy,
      userName: resolveUserName(tp.createdBy, tp.createdByName, dealerById),
      label: `Добавил ТТ: ${title}`,
      dealerId: tp.dealerId,
      tradePointId: tp.id,
    });
  }

  for (const ov of Object.values(state.tradePointOverridesById)) {
    const t = isoToMs(ov.updatedAt);
    if (t == null) continue;
    pushEv(out, {
      kind: "trade_point_updated",
      atMs: t,
      userId: ov.updatedBy,
      userName: resolveUserName(ov.updatedBy, ov.updatedByName, dealerById),
      label: `Обновил торговую точку`,
      dealerId: ov.dealerId,
      tradePointId: ov.tradePointId,
    });
  }

  for (const ar of Object.values(state.archivedDealersById)) {
    const t = isoToMs(ar.archivedAt);
    if (t == null) continue;
    const row = dealerById.get(ar.dealerId);
    pushEv(out, {
      kind: "archive_dealer",
      atMs: t,
      userId: ar.archivedBy,
      userName: resolveUserName(ar.archivedBy, ar.archivedByName, dealerById),
      label: `Архивировал клиента: ${row?.name ?? ar.dealerId}`,
      dealerId: ar.dealerId,
    });
  }

  for (const ar of Object.values(state.archivedTradePointsById)) {
    const t = isoToMs(ar.archivedAt);
    if (t == null) continue;
    pushEv(out, {
      kind: "archive_trade_point",
      atMs: t,
      userId: ar.archivedBy,
      userName: resolveUserName(ar.archivedBy, ar.archivedByName, dealerById),
      label: `Архивировал торговую точку`,
      dealerId: ar.dealerId,
      tradePointId: ar.tradePointId,
    });
  }

  for (const ar of Object.values(state.archivedLegalEntitiesById)) {
    const t = isoToMs(ar.archivedAt);
    if (t == null) continue;
    pushEv(out, {
      kind: "archive_legal",
      atMs: t,
      userId: ar.archivedBy,
      userName: resolveUserName(ar.archivedBy, ar.archivedByName, dealerById),
      label: `Архивировал юрлицо`,
      dealerId: ar.dealerId,
    });
  }

  for (const ar of Object.values(state.archivedDealerContactsById)) {
    const t = isoToMs(ar.archivedAt);
    if (t == null) continue;
    pushEv(out, {
      kind: "archive_contact",
      atMs: t,
      userId: ar.archivedBy,
      userName: resolveUserName(ar.archivedBy, ar.archivedByName, dealerById),
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
      const by = normalizeText(o.updatedBy ?? o.createdBy ?? st.createdById) || normalizeText(st.createdById) || "unknown";
      const byName = normalizeText(o.updatedByName ?? o.createdByName);
      pushEv(out, {
        kind: "legal_entity",
        atMs: t,
        userId: by,
        userName: resolveUserName(by, byName, dealerById),
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
      pushEv(out, {
        kind: "photo",
        atMs: t,
        userId: ph.uploadedBy,
        userName: resolveUserName(ph.uploadedBy, ph.uploadedByName, dealerById),
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
      pushEv(out, {
        kind: "photo",
        atMs: t,
        userId: ph.uploadedBy,
        userName: resolveUserName(ph.uploadedBy, ph.uploadedByName, dealerById),
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
    pushEv(out, {
      kind: "showcase",
      atMs: t,
      userId: sh.updatedBy,
      userName: resolveUserName(sh.updatedBy, sh.updatedByName, dealerById),
      label: `Заполнил витрину ТТ`,
      dealerId: sh.dealerId,
      tradePointId: sh.tradePointId,
    });
  }

  for (const c of Object.values(state.dealerActualizationContactsById)) {
    const t = isoToMs(c.updatedAt) ?? isoToMs(c.createdAt);
    if (t == null) continue;
    const uid = normalizeText(c.updatedBy);
    if (!uid) continue;
    pushEv(out, {
      kind: "contact",
      atMs: t,
      userId: uid,
      userName: resolveUserName(uid, c.updatedByName, dealerById),
      label: `Контакт клиента: ${c.fullName || "без имени"}`,
      dealerId: c.dealerId,
    });
  }

  for (const sh of Object.values(state.tradePointShowcaseActualizationById)) {
    const tasks = sh.showcaseMatrixTasks ?? [];
    for (const task of tasks) {
      const t = isoToMs(task.createdAt);
      if (t == null) continue;
      pushEv(out, {
        kind: "matrix_task",
        atMs: t,
        userId: task.createdBy,
        userName: resolveUserName(task.createdBy, task.createdByName, dealerById),
        label: `Задача по матрице: ${normalizeText(task.productName) || "без названия"}`,
        dealerId: task.dealerId,
        tradePointId: task.tradePointId,
      });
    }
  }

  out.sort((a, b) => b.atMs - a.atMs);
  return out;
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

const SCORE: Partial<Record<ActivityEventKind, number>> = {
  manual_dealer: 3,
  dealer_updated: 2,
  manual_trade_point: 2,
  trade_point_updated: 1,
  legal_entity: 2,
  contact: 1,
  photo: 1,
  showcase: 2,
  archive_dealer: 1,
  archive_trade_point: 1,
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
    a.lastAtMs = Math.max(a.lastAtMs, ev.atMs);
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
      case "archive_dealer":
      case "archive_trade_point":
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

  return Array.from(byUser.values()).sort((x, y) => y.score - x.score || y.lastAtMs - x.lastAtMs);
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

export function computeTopKpis(
  state: ActualizationState,
  profile: ReleaseDemoProfile,
  range: { startMs: number; endMs: number } | null,
  managerAggs: ManagerActivityAgg[],
): KpiTop {
  let manualDealers = 0;
  for (const d of Object.values(state.manuallyCreatedDealersById)) {
    const t = isoToMs(d.createdAt);
    if (t != null && inActivityRange(t, range)) manualDealers += 1;
  }
  let updatedDealers = 0;
  for (const ov of Object.values(state.dealerOverridesById)) {
    const t = isoToMs(ov.updatedAt);
    if (t != null && inActivityRange(t, range)) updatedDealers += 1;
  }
  let manualTradePoints = 0;
  for (const tp of Object.values(state.manuallyCreatedTradePointsById)) {
    const t = isoToMs(tp.createdAt);
    if (t != null && inActivityRange(t, range)) manualTradePoints += 1;
  }
  let legalTouches = 0;
  for (const st of Object.values(state.legalEntityOverridesByDealerId)) {
    for (const raw of Object.values(st?.overridesById ?? {})) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const o = raw as Record<string, unknown>;
      const t = isoToMs((o.updatedAt as string) || (o.createdAt as string));
      if (t != null && inActivityRange(t, range)) legalTouches += 1;
    }
  }
  let photos = 0;
  for (const list of Object.values(state.dealerPhotosByDealerId)) {
    for (const ph of list ?? []) {
      if (ph.archivedAt) continue;
      const t = isoToMs(ph.uploadedAt);
      if (t != null && inActivityRange(t, range)) photos += 1;
    }
  }
  for (const list of Object.values(state.tradePointPhotosByTradePointId)) {
    for (const ph of list ?? []) {
      if (ph.archivedAt) continue;
      const t = isoToMs(ph.uploadedAt);
      if (t != null && inActivityRange(t, range)) photos += 1;
    }
  }

  const tpRows = buildTradePointListForActualization(state, profile, { includeArchivedTradePoints: true });
  let showcasesFilled = 0;
  let deficitTradePoints = 0;
  for (const r of tpRows) {
    if (r.showcaseBucket === "has_showcase") {
      const tShow = isoToMs(r.showcaseUpdatedAt);
      if (!range || (tShow != null && inActivityRange(tShow, range))) showcasesFilled += 1;
    }
    if (r.matrixDeficitCount > 0) deficitTradePoints += 1;
  }

  let openMatrixTasks = 0;
  for (const sh of Object.values(state.tradePointShowcaseActualizationById)) {
    for (const t of sh.showcaseMatrixTasks ?? []) {
      if (t.status === "new") openMatrixTasks += 1;
    }
  }

  const activeManagers = managerAggs.filter((m) => m.totalActions > 0).length;

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
    const tps = mergeTradePointsForActualization(r, state);
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

export type ProblemLine = { id: string; severity: "info"; text: string };

export function computeProblemLines(state: ActualizationState, profile: ReleaseDemoProfile, dealerRows: DealerRow[]): ProblemLine[] {
  const lines: ProblemLine[] = [];
  const scoped = dealerRows.filter((r) => !r.id.startsWith("archived-"));

  for (const r of scoped) {
    const inn = (r.actualizationInn ?? "").replace(/\D/g, "");
    if (inn.length < 10) lines.push({ id: `inn-${r.id}`, severity: "info", text: `Клиент без ИНН: ${r.name}` });
  }

  for (const r of scoped) {
    const tps = mergeTradePointsForActualization(r, state);
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
