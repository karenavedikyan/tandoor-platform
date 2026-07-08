export type StoreColumnKey =
  | "holding"
  | "address"
  | "legal_name"
  | "contact"
  | "fill"
  | "vh"
  | "mk"
  | "hw"
  | "rot"
  | "client_type"
  | "payment"
  | "city"
  | "rm"
  | "manager"
  | "status";

export type StoreColumnConfig = {
  key: StoreColumnKey;
  visible: boolean;
};

export type StoreColumnsState = StoreColumnConfig[];

export const STORE_COLUMN_KEYS: StoreColumnKey[] = [
  "holding",
  "address",
  "legal_name",
  "contact",
  "fill",
  "vh",
  "mk",
  "hw",
  "rot",
  "client_type",
  "payment",
  "city",
  "rm",
  "manager",
  "status",
];

export const STORE_COLUMN_LABELS: Record<StoreColumnKey, string> = {
  holding: "Холдинг",
  address: "ТТ (адрес)",
  legal_name: "Юрлицо",
  contact: "Тел / Email (юрлицо)",
  fill: "Заполненность",
  vh: "ВХ",
  mk: "МК",
  hw: "Фурн",
  rot: "Ротация",
  client_type: "Тип клиента",
  payment: "Оплата",
  city: "Город",
  rm: "РМ",
  manager: "Менеджер",
  status: "Статус",
};

export const DEFAULT_STORE_COLUMNS: StoreColumnsState = [
  { key: "holding", visible: true },
  { key: "address", visible: true },
  { key: "legal_name", visible: true },
  { key: "contact", visible: true },
  { key: "fill", visible: true },
  { key: "vh", visible: true },
  { key: "mk", visible: true },
  { key: "hw", visible: true },
  { key: "rot", visible: true },
  { key: "client_type", visible: false },
  { key: "payment", visible: false },
  { key: "city", visible: false },
  { key: "rm", visible: false },
  { key: "manager", visible: true },
  { key: "status", visible: false },
];

export const ONE_C_STORES_COLUMNS_STORAGE_KEY = "oneC.storesColumns.v1";

const KEY_SET = new Set<string>(STORE_COLUMN_KEYS);

export function isStoreColumnKey(value: string): value is StoreColumnKey {
  return KEY_SET.has(value);
}

export function mergeStoreColumnsState(saved: StoreColumnsState | null): StoreColumnsState {
  if (!saved || saved.length === 0) return DEFAULT_STORE_COLUMNS.map((c) => ({ ...c }));

  const result: StoreColumnsState = [];
  const seen = new Set<StoreColumnKey>();

  for (const col of saved) {
    if (!isStoreColumnKey(col.key) || seen.has(col.key)) continue;
    seen.add(col.key);
    result.push({ key: col.key, visible: Boolean(col.visible) });
  }

  for (const key of STORE_COLUMN_KEYS) {
    if (seen.has(key)) continue;
    result.push({ key, visible: true });
  }

  return result;
}

export function toggleStoreColumn(
  columns: StoreColumnsState,
  key: StoreColumnKey,
): StoreColumnsState {
  return columns.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col));
}

export function reorderStoreColumns(
  columns: StoreColumnsState,
  fromIdx: number,
  toIdx: number,
): StoreColumnsState {
  if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= columns.length || toIdx >= columns.length) {
    return columns;
  }
  const next = [...columns];
  const [moved] = next.splice(fromIdx, 1);
  if (!moved) return columns;
  next.splice(toIdx, 0, moved);
  return next;
}

export function visibleStoreColumns(columns: StoreColumnsState): StoreColumnsState {
  return columns.filter((col) => col.visible);
}

export function parseStoreColumnsState(raw: string | null): StoreColumnsState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const cols: StoreColumnsState = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const key = (item as { key?: unknown }).key;
      const visible = (item as { visible?: unknown }).visible;
      if (typeof key !== "string" || !isStoreColumnKey(key)) continue;
      cols.push({ key, visible: Boolean(visible) });
    }
    return cols.length > 0 ? cols : null;
  } catch {
    return null;
  }
}
