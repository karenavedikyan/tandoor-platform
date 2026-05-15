/**
 * Рабочие сигналы по оборудованию точки (пилот, без подтверждения фактических остатков и без дублирования задач по витрине).
 */

import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

export type DealerEquipmentStatus = "ok" | "needs_check" | "missing" | "outdated";

export type DealerEquipmentItem = {
  id: string;
  type: string;
  label: string;
  count?: number;
  status?: DealerEquipmentStatus;
  comment?: string;
};

export type DealerEquipmentSignal = {
  hasEquipment: boolean;
  summary: string;
  status: DealerEquipmentStatus;
  statusLabel: string;
  items: DealerEquipmentItem[];
  lastCheckDate?: string;
  reason?: string;
};

function charSum(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) n += s.charCodeAt(i);
  return n;
}

const CAT: Record<ClientCategoryId, number> = {
  top150: 3,
  top350: 5,
  top500: 7,
  top500plus: 11,
  potential: 13,
  lead: 17,
  no_sales: 19,
  uncategorized: 23,
};

function norm(s: string | undefined): string {
  return (s ?? "").trim();
}

function isPlaceholder(t: string): boolean {
  const s = t.toLowerCase();
  if (!s) return true;
  if (s === "—" || s === "-" || s === "n/a") return true;
  if (s.includes("данные планируются")) return true;
  if (s.includes("уточняется")) return true;
  return false;
}

function statusRank(s: DealerEquipmentStatus): number {
  switch (s) {
    case "missing":
      return 0;
    case "outdated":
      return 1;
    case "needs_check":
      return 2;
    default:
      return 3;
  }
}

function worst(a: DealerEquipmentStatus, b: DealerEquipmentStatus): DealerEquipmentStatus {
  return statusRank(a) < statusRank(b) ? a : b;
}

function parseLineStatus(text: string): DealerEquipmentStatus | undefined {
  const s = text.toLowerCase();
  if (s.includes("устар") || s.includes("замен") || s.includes("снят")) return "outdated";
  if (s.includes("нет") || s.includes("отсут") || s.includes("не выстав")) return "missing";
  if (s.includes("провер") || s.includes("контрол") || s.includes("актуализ")) return "needs_check";
  return undefined;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function statusToLabels(status: DealerEquipmentStatus, hasRows: boolean): { statusLabel: string; summary: string } {
  if (!hasRows && status === "missing") {
    return { statusLabel: "Оборудование не указано", summary: "Оборудование: не указано" };
  }
  switch (status) {
    case "ok":
      return { statusLabel: "Есть витринное оборудование", summary: "Есть витринное оборудование" };
    case "needs_check":
      return { statusLabel: "Требуется проверка оборудования", summary: "Требуется проверка оборудования" };
    case "outdated":
      return { statusLabel: "Оборудование устарело", summary: "Оборудование устарело" };
    case "missing":
      return { statusLabel: "Оборудование не указано", summary: "Оборудование не указано" };
  }
}

export function getDealerEquipmentSignal(row: DealerRow): DealerEquipmentSignal {
  const ext = row as DealerRow & { releaseEquipmentNote?: string };
  const hash =
    charSum(row.id) +
    charSum(row.city) * 5 +
    charSum(row.name) * 3 +
    Math.round(row.distribution) * 11 +
    (CAT[row.clientCategory] ?? 29);

  const items: DealerEquipmentItem[] = [];
  const showcaseEq = norm(row.showcase?.equipment);
  const showcaseTodo = norm(row.showcase?.todo);
  const showcaseStatus = norm(row.showcase?.status);
  const releaseNote = norm(ext.releaseEquipmentNote);

  if (!isPlaceholder(releaseNote)) {
    items.push({
      id: `${row.id}-eq-release`,
      type: "release_note",
      label: "Данные по оборудованию",
      comment: releaseNote,
      status: parseLineStatus(releaseNote) ?? (hash % 10 === 0 ? "needs_check" : "ok"),
    });
  }

  if (!isPlaceholder(showcaseEq)) {
    items.push({
      id: `${row.id}-eq-showcase`,
      type: "showcase_row",
      label: "Витринное оборудование (справочно)",
      comment: showcaseEq,
      status: parseLineStatus(showcaseEq),
    });
  }

  if (!isPlaceholder(showcaseStatus) && showcaseStatus !== "—") {
    const st = parseLineStatus(showcaseStatus);
    if (st) {
      items.push({
        id: `${row.id}-eq-showcase-status`,
        type: "showcase_status",
        label: "Статус витрины (связь с оборудованием)",
        comment: showcaseStatus,
        status: st,
      });
    }
  }

  for (let i = 0; i < row.tradePoints.length; i += 1) {
    const tp = row.tradePoints[i]!;
    const eq = norm(tp.equipment);
    if (!isPlaceholder(eq)) {
      items.push({
        id: `${row.id}-eq-tp-${tp.id}`,
        type: "trade_point",
        label: tp.name || `Торговая точка ${i + 1}`,
        comment: eq,
        status: parseLineStatus(eq),
      });
    }
  }

  if (!isPlaceholder(showcaseTodo) && showcaseTodo.length > 2) {
    items.push({
      id: `${row.id}-eq-todo`,
      type: "showcase_todo",
      label: "План по витрине (оборудование)",
      comment: showcaseTodo,
      status: parseLineStatus(showcaseTodo) ?? "needs_check",
    });
  }

  if (items.length === 0) {
    if (hash % 4 === 0) {
      const { statusLabel, summary } = statusToLabels("missing", false);
      return {
        hasEquipment: false,
        summary,
        status: "missing",
        statusLabel,
        items: [],
        reason: "В учёте не заполнены витринные стойки и бренд-зона — уточните на точке.",
      };
    }

    const stMain: DealerEquipmentStatus = hash % 13 === 0 ? "outdated" : hash % 11 === 0 ? "needs_check" : "ok";
    const stBrand: DealerEquipmentStatus = hash % 17 === 0 ? "missing" : hash % 9 === 0 ? "needs_check" : "ok";
    items.push({
      id: `${row.id}-eq-stand`,
      type: "stand",
      label: "Витринные стойки",
      count: 1 + (hash % 4),
      status: stMain,
    });
    if (hash % 5 !== 2) {
      items.push({
        id: `${row.id}-eq-brand`,
        type: "brand_zone",
        label: "Бренд-зона",
        count: 1,
        status: stBrand,
      });
    }
  }

  let agg: DealerEquipmentStatus = "ok";
  for (const it of items) {
    if (it.status) agg = worst(agg, it.status);
  }

  const hasEquipment = items.length > 0;

  let { statusLabel, summary } = statusToLabels(agg, hasEquipment);

  if (agg === "ok" && hasEquipment) {
    summary = "Есть витринное оборудование";
    statusLabel = "Есть витринное оборудование";
  }

  const lastCheckDate = hash % 6 === 0 ? undefined : isoDaysAgo(8 + (hash % 35));

  let reason: string | undefined;
  if (agg === "needs_check") {
    reason = "Запланируйте осмотр стоек и бренд-зоны, сверьте с актуальным планом выкладки.";
  } else if (agg === "missing") {
    reason = "Нет данных по части оборудования — зафиксируйте фактическую выкладку в паспорте точки.";
  } else if (agg === "outdated") {
    reason = "По оценке требуется обновление образцов или креплений — согласуйте замену.";
  }

  return {
    hasEquipment,
    summary,
    status: agg,
    statusLabel,
    items,
    lastCheckDate,
    reason,
  };
}
