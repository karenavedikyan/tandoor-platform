export type OrderColumnKey =
  | "order_number"
  | "created_at"
  | "status"
  | "store"
  | "legal"
  | "manager"
  | "total"
  | "items_count"
  | "delivery";

export type OrderColumnConfig = {
  key: OrderColumnKey;
  visible: boolean;
};

export type OrderColumnsState = OrderColumnConfig[];

export const ORDER_COLUMN_KEYS: OrderColumnKey[] = [
  "order_number",
  "created_at",
  "status",
  "store",
  "legal",
  "manager",
  "total",
  "items_count",
  "delivery",
];

export const ORDER_COLUMN_LABELS: Record<OrderColumnKey, string> = {
  order_number: "Номер",
  created_at: "Дата",
  status: "Статус",
  store: "ТТ",
  legal: "Юрлицо",
  manager: "Менеджер",
  total: "Сумма",
  items_count: "Товаров",
  delivery: "Доставка",
};

export const DEFAULT_ORDER_COLUMNS: OrderColumnsState = ORDER_COLUMN_KEYS.map((key) => ({
  key,
  visible: true,
}));

export const ONE_C_ORDERS_COLUMNS_STORAGE_KEY = "oneC.ordersColumns.v1";

export function parseOrderColumnsState(raw: string | null): OrderColumnsState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const keys = new Set(ORDER_COLUMN_KEYS);
    const out: OrderColumnsState = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const key = (item as { key?: string }).key;
      const visible = (item as { visible?: boolean }).visible;
      if (typeof key === "string" && keys.has(key as OrderColumnKey)) {
        out.push({ key: key as OrderColumnKey, visible: visible !== false });
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function mergeOrderColumnsState(saved: OrderColumnsState | null): OrderColumnsState {
  if (!saved) return DEFAULT_ORDER_COLUMNS.map((c) => ({ ...c }));
  const byKey = new Map(saved.map((c) => [c.key, c.visible]));
  return ORDER_COLUMN_KEYS.map((key) => ({
    key,
    visible: byKey.has(key) ? byKey.get(key)! : true,
  }));
}

export function toggleOrderColumn(columns: OrderColumnsState, key: OrderColumnKey): OrderColumnsState {
  return columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
}

export function reorderOrderColumns(
  columns: OrderColumnsState,
  fromIdx: number,
  toIdx: number,
): OrderColumnsState {
  const next = [...columns];
  const [moved] = next.splice(fromIdx, 1);
  if (!moved) return columns;
  next.splice(toIdx, 0, moved);
  return next;
}
