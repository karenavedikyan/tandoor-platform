export const BITRIX24_IMPORTED_TASKS_STORAGE_KEY = "tandoor-bitrix24-imported-tasks-v1";

export const BITRIX24_IMPORTED_TASKS_CHANGED_EVENT = "tandoor-bitrix24-imported-tasks-changed";

export type Bitrix24ImportedTask = {
  id: string;
  bitrixTaskId: string;
  title: string;
  description: string;
  status: string;
  responsibleId: string;
  createdBy: string;
  createdDate: string;
  deadline?: string | null;
  changedDate?: string | null;
  importedAt: string;
};

type StoredState = {
  tasks: Bitrix24ImportedTask[];
};

function emptyState(): StoredState {
  return { tasks: [] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseStored(raw: string | null): StoredState {
  if (!raw?.trim()) return emptyState();
  try {
    const j = JSON.parse(raw) as unknown;
    if (!isRecord(j) || !Array.isArray(j.tasks)) return emptyState();
    return { tasks: j.tasks as Bitrix24ImportedTask[] };
  } catch {
    return emptyState();
  }
}

export function loadBitrix24ImportedTasksState(): StoredState {
  if (typeof window === "undefined") return emptyState();
  return parseStored(window.localStorage.getItem(BITRIX24_IMPORTED_TASKS_STORAGE_KEY));
}

export function saveBitrix24ImportedTasksState(state: StoredState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BITRIX24_IMPORTED_TASKS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(BITRIX24_IMPORTED_TASKS_CHANGED_EVENT));
}

export function getBitrix24ImportedTasks(): Bitrix24ImportedTask[] {
  return [...loadBitrix24ImportedTasksState().tasks];
}

function newImportedRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bxi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Объединяет свежий ответ Bitrix24 с уже сохранённым: ключ — bitrixTaskId, порядок — как во входном массиве, затем остальные старые.
 */
export function upsertBitrix24ImportedTasks(
  incoming: Array<{
    bitrixTaskId: string;
    title: string;
    description: string;
    status: string;
    responsibleId: string;
    createdBy: string;
    createdDate: string;
    deadline?: string | null;
    changedDate?: string | null;
  }>,
): void {
  const now = new Date().toISOString();
  const prev = loadBitrix24ImportedTasksState().tasks;
  const byBx = new Map<string, Bitrix24ImportedTask>();
  for (const t of prev) {
    byBx.set(t.bitrixTaskId, t);
  }
  const ordered: Bitrix24ImportedTask[] = [];
  for (const row of incoming) {
    const bid = row.bitrixTaskId.trim();
    if (!bid) continue;
    const prevRow = byBx.get(bid);
    const next: Bitrix24ImportedTask = {
      id: prevRow?.id ?? newImportedRowId(),
      bitrixTaskId: bid,
      title: row.title,
      description: row.description,
      status: row.status,
      responsibleId: row.responsibleId,
      createdBy: row.createdBy,
      createdDate: row.createdDate,
      deadline: row.deadline ?? null,
      changedDate: row.changedDate ?? null,
      importedAt: now,
    };
    byBx.set(bid, next);
    ordered.push(next);
  }
  for (const t of prev) {
    if (!ordered.some((x) => x.bitrixTaskId === t.bitrixTaskId)) {
      ordered.push(t);
    }
  }
  saveBitrix24ImportedTasksState({ tasks: ordered.slice(0, 120) });
}
