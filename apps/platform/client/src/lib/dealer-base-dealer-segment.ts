/**
 * Сегментация клиентов для drill-down (город, менеджер) — единая логика.
 */

import { isClientTopTier, type ClientCategoryId } from "./client-category.js";
import { dealerNeedsAttention } from "./dealer-base-role-views.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import {
  getReleaseClients,
  getReleaseClientTypeLabel,
  getReleaseClientTypeTone,
  type ReleaseClient,
  type ReleaseClientTypeTone,
} from "./release-client-data.js";
import type { ReleaseClientNormalizedType } from "./release-client-seed.generated.js";

export type DealerBaseSegmentKey =
  | ReleaseClientNormalizedType
  | "active"
  | "potential"
  | "attention"
  | "no_segment";

export type DealerBaseSegmentRow = {
  key: DealerBaseSegmentKey;
  label: string;
  count: number;
  tone: ReleaseClientTypeTone;
};

const SEGMENT_DISPLAY_ORDER: DealerBaseSegmentKey[] = [
  "volume",
  "top150",
  "top350",
  "top500",
  "active",
  "potential",
  "attention",
  "closed",
  "nonTarget",
  "no_segment",
];

function categoryToSegmentKey(cat: ClientCategoryId): DealerBaseSegmentKey | null {
  if (cat === "top150") return "top150";
  if (cat === "top350") return "top350";
  if (cat === "top500" || cat === "top500plus") return cat === "top500plus" ? "volume" : "top500";
  if (cat === "new_client") return "no_segment";
  return null;
}

export function buildReleaseClientByCodeMap(): Map<string, ReleaseClient> {
  const map = new Map<string, ReleaseClient>();
  for (const c of getReleaseClients()) {
    const code = c.code?.trim();
    if (code) map.set(code, c);
  }
  return map;
}

/** @deprecated alias for city drill-down */
export type CityDetailSegmentKey = DealerBaseSegmentKey;

export function resolveDealerRowSegmentKey(
  row: DealerRow,
  releaseByCode: Map<string, ReleaseClient>,
): DealerBaseSegmentKey {
  if (dealerNeedsAttention(row)) return "attention";

  const code = row.releaseCode?.trim();
  if (code) {
    const rc = releaseByCode.get(code);
    if (rc && rc.normalizedClientType !== "unknown") {
      const nt = rc.normalizedClientType;
      if (
        nt === "volume" ||
        nt === "top150" ||
        nt === "top350" ||
        nt === "top500" ||
        nt === "potential" ||
        nt === "active" ||
        nt === "closed" ||
        nt === "nonTarget"
      ) {
        return nt;
      }
    }
  }

  if (isClientTopTier(row.clientCategory)) {
    const fromCat = categoryToSegmentKey(row.clientCategory);
    if (fromCat) return fromCat;
  }

  if (row.status === "потенциальный") return "potential";
  if (row.status === "активный") return "active";
  return "no_segment";
}

export function dealerBaseSegmentLabel(key: DealerBaseSegmentKey): string {
  if (key === "attention") return "Внимание";
  if (key === "active") return "Активные";
  if (key === "potential") return "Потенциальные";
  if (key === "no_segment") return "Без сегмента";
  return getReleaseClientTypeLabel(key);
}

export function dealerBaseSegmentTone(key: DealerBaseSegmentKey): ReleaseClientTypeTone {
  if (key === "attention") return "destructive";
  if (key === "active") return "secondary";
  if (key === "potential") return "outline";
  if (key === "no_segment") return "outline";
  return getReleaseClientTypeTone(key);
}

export function buildDealerRowSegments(rows: DealerRow[]): DealerBaseSegmentRow[] {
  const releaseByCode = buildReleaseClientByCodeMap();
  const counts = new Map<DealerBaseSegmentKey, number>();
  for (const row of rows) {
    const key = resolveDealerRowSegmentKey(row, releaseByCode);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return SEGMENT_DISPLAY_ORDER.filter((key) => (counts.get(key) ?? 0) > 0).map((key) => ({
    key,
    label: dealerBaseSegmentLabel(key),
    count: counts.get(key) ?? 0,
    tone: dealerBaseSegmentTone(key),
  }));
}

export function dealerRowMatchesSegment(
  row: DealerRow,
  segment: DealerBaseSegmentKey | null,
  releaseByCode?: Map<string, ReleaseClient>,
): boolean {
  if (!segment) return true;
  const map = releaseByCode ?? buildReleaseClientByCodeMap();
  return resolveDealerRowSegmentKey(row, map) === segment;
}

/** Цвет сегмента для мини-полоски (Tailwind bg-*). */
export function dealerBaseSegmentBarClass(key: DealerBaseSegmentKey): string {
  switch (key) {
    case "volume":
    case "top150":
      return "bg-amber-500/80";
    case "top350":
      return "bg-orange-500/75";
    case "top500":
      return "bg-orange-600/70";
    case "potential":
      return "bg-sky-500/70";
    case "attention":
      return "bg-red-500/75";
    case "active":
      return "bg-emerald-500/60";
    case "closed":
    case "nonTarget":
      return "bg-muted-foreground/40";
    default:
      return "bg-muted/60";
  }
}
