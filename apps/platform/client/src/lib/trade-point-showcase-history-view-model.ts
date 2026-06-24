import type {
  ShowcaseMatrixEventDto,
  ShowcaseMatrixStatus,
  ShowcasePlacementSegment,
  ShowcasePlacementType,
} from "./showcase-matrix-api.js";
import { getProductById } from "./catalog-data.js";
import { PLACEMENT_SEGMENT_LABEL_RU, PLACEMENT_TYPE_LABEL_RU } from "./showcase-placement-labels.js";
import { statusLabelRu } from "./trade-point-showcase-matrix-storage.js";

export type HistoryEventAction =
  | "status_change"
  | "placement_update"
  | "comment_only";

export type HistoryEventViewModel = {
  id: string;
  changedAt: string;
  changedByName: string;
  segment: ShowcasePlacementSegment | null;
  segmentLabel: string | null;
  placementType: ShowcasePlacementType | null;
  placementTypeLabel: string | null;
  targetKind: ShowcaseMatrixEventDto["targetKind"];
  targetLabel: string;
  oldStatusLabel: string | null;
  newStatusLabel: string | null;
  placementCapacity: number | null;
  capacityChangeLabel: string | null;
  comment: string | null;
  action: HistoryEventAction;
};

export type HistoryDayGroup = {
  dayIso: string;
  dayLabel: string;
  items: HistoryEventViewModel[];
};

export type HistoryFilter = {
  segment: "all" | ShowcasePlacementSegment;
  action: "all" | HistoryEventAction;
  userId: "all" | string;
  period: "all" | "last7" | "last30";
};

export function defaultHistoryFilter(): HistoryFilter {
  return { segment: "all", action: "all", userId: "all", period: "all" };
}

function targetLabelFor(e: ShowcaseMatrixEventDto): string {
  if (e.targetKind === "placement") {
    const seg = e.placementSegment ? PLACEMENT_SEGMENT_LABEL_RU[e.placementSegment] : "Сегмент —";
    const type = e.placementType ? PLACEMENT_TYPE_LABEL_RU[e.placementType] : "тип —";
    return `Блок размещения · ${seg} · ${type}`;
  }
  const p = getProductById(e.targetId);
  return p?.name?.trim() || e.targetId;
}

export function detectAction(e: ShowcaseMatrixEventDto): HistoryEventAction {
  if (e.targetKind === "placement") return "placement_update";
  if (e.oldStatus !== e.newStatus) return "status_change";
  return "comment_only";
}

function capacityChangeLabelFor(e: ShowcaseMatrixEventDto): string | null {
  if (e.targetKind !== "placement") return null;
  const comment = e.comment?.trim() ?? "";
  const capacityMatch = /^ёмкость\s+(\d+)\s*→\s*(\d+)$/.exec(comment);
  if (capacityMatch) {
    const seg = e.placementSegment ? PLACEMENT_SEGMENT_LABEL_RU[e.placementSegment] : "Сегмент —";
    const type = e.placementType ? PLACEMENT_TYPE_LABEL_RU[e.placementType] : "тип —";
    return `${type} · ${seg} · вместимость ${capacityMatch[1]} → ${capacityMatch[2]}`;
  }
  if (e.placementCapacity != null) {
    const seg = e.placementSegment ? PLACEMENT_SEGMENT_LABEL_RU[e.placementSegment] : "Сегмент —";
    const type = e.placementType ? PLACEMENT_TYPE_LABEL_RU[e.placementType] : "тип —";
    return `${type} · ${seg} · вместимость ${e.placementCapacity} витрин`;
  }
  return null;
}

export function toHistoryViewModel(e: ShowcaseMatrixEventDto): HistoryEventViewModel {
  const capacityChangeLabel = capacityChangeLabelFor(e);
  return {
    id: e.id,
    changedAt: e.changedAt,
    changedByName: e.changedByName?.trim() || "Без имени",
    segment: e.placementSegment,
    segmentLabel: e.placementSegment ? PLACEMENT_SEGMENT_LABEL_RU[e.placementSegment] : null,
    placementType: e.placementType,
    placementTypeLabel: e.placementType ? PLACEMENT_TYPE_LABEL_RU[e.placementType] : null,
    targetKind: e.targetKind,
    targetLabel: targetLabelFor(e),
    oldStatusLabel: e.oldStatus ? statusLabelRu(e.oldStatus as ShowcaseMatrixStatus) : null,
    newStatusLabel: e.newStatus ? statusLabelRu(e.newStatus as ShowcaseMatrixStatus) : null,
    placementCapacity: e.placementCapacity,
    capacityChangeLabel,
    comment:
      capacityChangeLabel && /^ёмкость\s+\d+\s*→\s*\d+$/.test(e.comment?.trim() ?? "")
        ? null
        : e.comment?.trim() || null,
    action: detectAction(e),
  };
}

function periodCutoffIso(period: HistoryFilter["period"], now: number = Date.now()): string | null {
  if (period === "all") return null;
  const days = period === "last7" ? 7 : 30;
  return new Date(now - days * 86_400_000).toISOString();
}

export function filterHistoryEvents(
  events: readonly ShowcaseMatrixEventDto[],
  filter: HistoryFilter,
  now?: number,
): ShowcaseMatrixEventDto[] {
  const cutoff = periodCutoffIso(filter.period, now);
  return events.filter((e) => {
    if (filter.segment !== "all" && e.placementSegment !== filter.segment) return false;
    if (filter.action !== "all" && detectAction(e) !== filter.action) return false;
    if (filter.userId !== "all" && e.changedBy !== filter.userId) return false;
    if (cutoff && e.changedAt < cutoff) return false;
    return true;
  });
}

export function ymdInTimezone(iso: string, tz = "Europe/Moscow"): string {
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${day}`;
  } catch {
    return iso.slice(0, 10);
  }
}

function dayLabelFor(dayIso: string, todayIso: string): string {
  if (dayIso === todayIso) return "Сегодня";
  const t = new Date(`${todayIso}T00:00:00Z`).getTime();
  const d = new Date(`${dayIso}T00:00:00Z`).getTime();
  if (t - d === 86_400_000) return "Вчера";
  const [y, m, dd] = dayIso.split("-");
  return `${dd}.${m}.${y}`;
}

export function groupEventsByDay(
  events: readonly ShowcaseMatrixEventDto[],
  now?: number,
  tz = "Europe/Moscow",
): HistoryDayGroup[] {
  const todayIso = ymdInTimezone(new Date(now ?? Date.now()).toISOString(), tz);
  const byDay = new Map<string, HistoryEventViewModel[]>();
  for (const e of events) {
    const day = ymdInTimezone(e.changedAt, tz);
    const arr = byDay.get(day) ?? [];
    arr.push(toHistoryViewModel(e));
    byDay.set(day, arr);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dayIso, items]) => ({
      dayIso,
      dayLabel: dayLabelFor(dayIso, todayIso),
      items: items.sort((a, b) => (a.changedAt < b.changedAt ? 1 : a.changedAt > b.changedAt ? -1 : 0)),
    }));
}

export function uniqueUsersFromEvents(
  events: readonly ShowcaseMatrixEventDto[],
): Array<{ id: string; name: string }> {
  const m = new Map<string, string>();
  for (const e of events) {
    const id = e.changedBy?.trim();
    if (!id) continue;
    if (!m.has(id)) m.set(id, e.changedByName?.trim() || id);
  }
  return Array.from(m.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function formatHistoryTime(iso: string, tz = "Europe/Moscow"): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}
