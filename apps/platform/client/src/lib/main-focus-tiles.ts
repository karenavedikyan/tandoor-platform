/**
 * Фокус-срезы на главной (РОП / директор): подсчёт активных клиентов и ссылки в клиентскую базу.
 */

import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { getDealerBaseSegment, type DealerBaseSegmentId } from "@/lib/dealer-base-segments";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  DEALER_CHARACTERISTIC_LABELS,
  getDealerCharacteristicValue,
  type DealerCharacteristicId,
} from "@/lib/dealer-characteristics";
import { DEALER_BASE_SEGMENT_LABELS } from "@/lib/dealer-base-segments";
import { getClientCategoryLabel, type ClientCategoryId } from "@/lib/client-category";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";

/** Категории из URL `category=`, при которых включается фокус-просмотр (ссылки с главной, Промт 58). */
const FOCUS_VIEW_CATEGORY_IDS: readonly ClientCategoryId[] = [
  "top150",
  "top350",
  "top500",
  "top500plus",
  "lead",
] as const;

export type FocusViewChipMeta = {
  icon: string;
  label: string;
};

export type MainFocusTileId =
  | "top150"
  | "top350"
  | "top500"
  | "top500plus"
  | "lead"
  | "has_tandoor_club"
  | "has_cashback_agent"
  | "other"
  | "stale_actualization"
  | "inactive_60"
  | "has_warehouse";

export type MainFocusTileDef = {
  id: MainFocusTileId;
  icon: string;
  title: string;
  subtitle: string;
};

export const MAIN_FOCUS_TILES: readonly MainFocusTileDef[] = [
  { id: "top150", icon: "🔥", title: "TOP 150", subtitle: "из 150 в фокусе" },
  { id: "top350", icon: "⭐", title: "TOP 350", subtitle: "из 350" },
  { id: "top500", icon: "🎯", title: "TOP 500", subtitle: "из 500" },
  { id: "top500plus", icon: "🌐", title: "TOP 500+", subtitle: "массовый сегмент" },
  { id: "lead", icon: "🆕", title: "Новые", subtitle: "лиды и онбординг" },
  { id: "has_tandoor_club", icon: "🎖", title: "Тандор Клуб", subtitle: "участники клуба" },
  { id: "has_cashback_agent", icon: "💰", title: "Тандор Бонус", subtitle: "на бонусной программе" },
  { id: "other", icon: "📦", title: "Прочие", subtitle: "вне ТОПов" },
  { id: "stale_actualization", icon: "⏰", title: "Актуализация просрочена", subtitle: "давно не обновлялись" },
  { id: "inactive_60", icon: "📉", title: "Без активности 60+ дней", subtitle: "кандидаты на архив" },
  { id: "has_warehouse", icon: "🏬", title: "Склад", subtitle: "клиенты со складом" },
] as const;

const MS_PER_DAY = 86400000;
const STALE_ACTUALIZATION_DAYS = 30;
const INACTIVE_ACTIVITY_DAYS = 60;

function isoToMs(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function firstResolvedActivityMs(...candidates: (string | null | undefined)[]): number | null {
  for (const c of candidates) {
    const t = isoToMs(c);
    if (t != null) return t;
  }
  return null;
}

function parseLooseActivityMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === "—" || s === "-") return null;
  const iso = isoToMs(s);
  if (iso != null) return iso;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export function getDealerLastActualizedMs(dealerId: string, act: ActualizationState): number | null {
  const audit = act.dealerActualizationAuditByDealerId[dealerId];
  const fromAudit = isoToMs(audit?.lastUpdatedAt);
  if (fromAudit != null) return fromAudit;
  const manual = act.manuallyCreatedDealersById[dealerId];
  if (manual) {
    const t = firstResolvedActivityMs(manual.createdAt, manual.updatedAt);
    if (t != null && t > 0) return t;
  }
  const ov = act.dealerOverridesById[dealerId];
  const fromOv = isoToMs(ov?.updatedAt);
  if (fromOv != null) return fromOv;
  return null;
}

export function isDealerActualizationStale(dealerId: string, act: ActualizationState, nowMs = Date.now()): boolean {
  const at = getDealerLastActualizedMs(dealerId, act);
  if (at == null) return true;
  return nowMs - at > STALE_ACTUALIZATION_DAYS * MS_PER_DAY;
}

export function isDealerInactive60Plus(row: DealerRow, nowMs = Date.now()): boolean {
  const at = parseLooseActivityMs(row.lastActivity);
  if (at == null) return true;
  return nowMs - at > INACTIVE_ACTIVITY_DAYS * MS_PER_DAY;
}

function segmentForTile(id: MainFocusTileId): DealerBaseSegmentId | null {
  switch (id) {
    case "top150":
      return "top150";
    case "top350":
      return "top350";
    case "top500":
      return "top500";
    case "top500plus":
      return "top500_plus";
    case "lead":
      return "new";
    case "other":
      return "other";
    default:
      return null;
  }
}

function characteristicForTile(id: MainFocusTileId): DealerCharacteristicId | null {
  if (id === "has_tandoor_club" || id === "has_cashback_agent" || id === "has_warehouse") return id;
  return null;
}

export function dealerRowMatchesFocusTile(
  row: DealerRow,
  focus: MainFocusTileId,
  act: ActualizationState,
  nowMs = Date.now(),
): boolean {
  const seg = segmentForTile(focus);
  if (seg != null) return getDealerBaseSegment(row) === seg;

  const charId = characteristicForTile(focus);
  if (charId != null) return getDealerCharacteristicValue(row.id, charId) === "yes";

  if (focus === "stale_actualization") return isDealerActualizationStale(row.id, act, nowMs);
  if (focus === "inactive_60") return isDealerInactive60Plus(row, nowMs);
  return true;
}

export function computeMainFocusTileCounts(
  rows: DealerRow[],
  act: ActualizationState,
  nowMs = Date.now(),
): Record<MainFocusTileId, number> {
  const out = Object.fromEntries(MAIN_FOCUS_TILES.map((t) => [t.id, 0])) as Record<MainFocusTileId, number>;
  for (const row of rows) {
    for (const tile of MAIN_FOCUS_TILES) {
      if (dealerRowMatchesFocusTile(row, tile.id, act, nowMs)) out[tile.id] += 1;
    }
  }
  return out;
}

export type MainFocusTileHrefParams = Record<string, string | number | boolean | null | undefined>;

/** Ссылка на /dealer-base с префильтром для плитки. */
export function buildMainFocusTileHref(tileId: MainFocusTileId, baseParams: MainFocusTileHrefParams = {}): string {
  const seg = segmentForTile(tileId);
  if (seg != null) {
    if (seg === "top150" || seg === "top350" || seg === "top500") {
      const category =
        seg === "top150" ? "top150" : seg === "top350" ? "top350" : "top500";
      return buildBrowserHashAppHref("/dealer-base", { ...baseParams, category });
    }
    if (seg === "top500_plus") {
      return buildBrowserHashAppHref("/dealer-base", { ...baseParams, category: "top500plus" });
    }
    if (seg === "new") {
      return buildBrowserHashAppHref("/dealer-base", { ...baseParams, category: "lead" });
    }
    return buildBrowserHashAppHref("/dealer-base", { ...baseParams, segment: "other" });
  }

  const charId = characteristicForTile(tileId);
  if (charId != null) {
    return buildBrowserHashAppHref("/dealer-base", { ...baseParams, characteristic: charId });
  }

  return buildBrowserHashAppHref("/dealer-base", { ...baseParams, focus: tileId });
}

export function parseMainFocusTileId(raw: string | null | undefined): MainFocusTileId | null {
  if (!raw) return null;
  const id = raw.trim() as MainFocusTileId;
  return MAIN_FOCUS_TILES.some((t) => t.id === id) ? id : null;
}

export function parseDealerBaseSegmentFromUrl(raw: string | null | undefined): DealerBaseSegmentId | null {
  if (!raw) return null;
  const id = raw.trim() as DealerBaseSegmentId;
  const allowed: DealerBaseSegmentId[] = ["top150", "top350", "top500", "top500_plus", "new", "other"];
  return allowed.includes(id) ? id : null;
}

export function parseDealerCharacteristicFromUrl(raw: string | null | undefined): DealerCharacteristicId | null {
  if (!raw) return null;
  const id = raw.trim() as DealerCharacteristicId;
  if (id === "has_tandoor_club" || id === "has_cashback_agent" || id === "has_warehouse") return id;
  return null;
}

function segmentChipIcon(seg: DealerBaseSegmentId): string {
  switch (seg) {
    case "top150":
      return "🔥";
    case "top350":
      return "⭐";
    case "top500":
      return "🎯";
    case "top500_plus":
      return "🌐";
    case "new":
      return "🆕";
    default:
      return "📦";
  }
}

function categoryToSegmentId(cat: ClientCategoryId): DealerBaseSegmentId | null {
  switch (cat) {
    case "top150":
      return "top150";
    case "top350":
      return "top350";
    case "top500":
      return "top500";
    case "top500plus":
      return "top500_plus";
    case "lead":
      return "new";
    default:
      return null;
  }
}

/** Режим «Фокус-просмотр» на /dealer-base (префильтр с главной или прямой URL). */
export function isDealerBaseFocusViewParams(params: URLSearchParams): boolean {
  if (params.get("focus")?.trim() || params.get("characteristic")?.trim() || params.get("segment")?.trim()) {
    return true;
  }
  const cat = params.get("category")?.trim() as ClientCategoryId | undefined;
  if (cat && (FOCUS_VIEW_CATEGORY_IDS as readonly string[]).includes(cat)) return true;
  return false;
}

/** Иконка и подпись для чипа фокус-просмотра. */
export function resolveFocusViewChipMeta(params: URLSearchParams): FocusViewChipMeta | null {
  const focus = parseMainFocusTileId(params.get("focus"));
  if (focus) {
    const tile = MAIN_FOCUS_TILES.find((t) => t.id === focus);
    if (tile) return { icon: tile.icon, label: tile.title };
  }

  const char = parseDealerCharacteristicFromUrl(params.get("characteristic"));
  if (char) {
    const tile = MAIN_FOCUS_TILES.find((t) => t.id === char);
    if (tile) return { icon: tile.icon, label: tile.title };
    return { icon: "💰", label: DEALER_CHARACTERISTIC_LABELS[char] };
  }

  const seg = parseDealerBaseSegmentFromUrl(params.get("segment"));
  if (seg) {
    return { icon: segmentChipIcon(seg), label: DEALER_BASE_SEGMENT_LABELS[seg] };
  }

  const catRaw = params.get("category")?.trim() as ClientCategoryId | undefined;
  if (catRaw && (FOCUS_VIEW_CATEGORY_IDS as readonly string[]).includes(catRaw)) {
    const segFromCat = categoryToSegmentId(catRaw);
    if (segFromCat) {
      return { icon: segmentChipIcon(segFromCat), label: DEALER_BASE_SEGMENT_LABELS[segFromCat] };
    }
    return { icon: "🎯", label: getClientCategoryLabel(catRaw) };
  }

  return null;
}
