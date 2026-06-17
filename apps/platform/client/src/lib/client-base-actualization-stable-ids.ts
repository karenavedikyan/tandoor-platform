/**
 * Стабильные идентификаторы и проверки дублей для ручной актуализации клиентской базы.
 */

import type { DealerRow, DealerTradePoint } from "./dealer-base-mock-data.js";
import type { ActualizationState, ManualDealer, ManualTradePoint } from "./client-base-actualization-state.js";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Метка времени для id: yyyyMMddHHmmss (локальное время браузера). */
export function formatManualIdTimestamp(d = new Date()): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function shortRandom(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function generateStableManualDealerId(now = new Date()): string {
  return `manual-dealer-${formatManualIdTimestamp(now)}-${shortRandom()}`;
}

export function generateStableManualTradePointId(dealerId: string, now = new Date()): string {
  return `manual-tp-${dealerId}-${formatManualIdTimestamp(now)}-${shortRandom()}`;
}

/** Клиент, созданный только через актуализацию (не release-строка). */
export function isManualActualizationDealerId(dealerId: string): boolean {
  return dealerId.trim().startsWith("manual-dealer-");
}

/** Торговая точка, созданная только через актуализацию. */
export function isManualActualizationTradePointId(tradePointId: string): boolean {
  return tradePointId.trim().startsWith("manual-tp-");
}

export function normalizeInnDigits(inn: string): string {
  return inn.replace(/\D/g, "");
}

const TND_CL_RE = /^TND-CL-(\d{6})$/i;
const TND_TP_RE = /^TND-TP-(\d{6})$/i;
const MA_MANUAL_RE = /^MA-MANUAL-(\d+)$/i;

function parseTndClSerial(raw: string): number | null {
  const m = TND_CL_RE.exec(raw.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

function parseTndTpSerial(raw: string): number | null {
  const m = TND_TP_RE.exec(raw.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

function parseMaManualSerial(raw: string): number | null {
  const m = MA_MANUAL_RE.exec(raw.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

function fnv1a32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Стабильный показ кода до первой записи TND-CL в состояние (не меняет id). */
export function stableProvisionalTndClFromDealerId(dealerId: string): string {
  const n = 100000 + (fnv1a32(`TND-CL:${dealerId}`) % 900000);
  return `TND-CL-${String(n).padStart(6, "0")}`;
}

export function stableProvisionalTndTpFromTradePointId(tradePointId: string): string {
  const n = 100000 + (fnv1a32(`TND-TP:${tradePointId}`) % 900000);
  return `TND-TP-${String(n).padStart(6, "0")}`;
}

/** Код ТТ в списках/анкете: из данных релиза или стабильный TND-TP-* от id (id не меняется). */
export function getTradePointDisplayCodeForActualization(tp: Pick<DealerTradePoint, "id" | "releaseCode">): string {
  const c = tp.releaseCode?.trim();
  if (c) return c;
  return stableProvisionalTndTpFromTradePointId(tp.id);
}

function maxDealerCodeSerial(state: ActualizationState): number {
  let max = 0;
  for (const m of Object.values(state.manuallyCreatedDealersById)) {
    const raw = (m.internalCode ?? "").trim();
    let n = parseTndClSerial(raw);
    if (n == null) n = parseMaManualSerial(raw);
    if (n != null) max = Math.max(max, n);
  }
  return max;
}

/** Следующий свободный код TND-CL-000001 по ручным клиентам (учитывает legacy MA-MANUAL-*). */
export function nextManualDealerInternalCode(state: ActualizationState): string {
  return `TND-CL-${String(maxDealerCodeSerial(state) + 1).padStart(6, "0")}`;
}

function maxTradePointCodeSerial(state: ActualizationState): number {
  let max = 0;
  for (const m of Object.values(state.manuallyCreatedTradePointsById)) {
    const raw = (m.internalCode ?? "").trim();
    let n = parseTndTpSerial(raw);
    if (n == null) n = parseMaManualSerial(raw);
    if (n != null) max = Math.max(max, n);
  }
  return max;
}

export function nextManualTradePointInternalCode(state: ActualizationState): string {
  return `TND-TP-${String(maxTradePointCodeSerial(state) + 1).padStart(6, "0")}`;
}

/** Код клиента для UI (TND-CL или стабильный provisional, пока не сохранён internalCode). */
export function getManualDealerDisplayCode(m: ManualDealer): string {
  const raw = (m.internalCode ?? "").trim();
  const tnd = parseTndClSerial(raw);
  if (tnd != null) return `TND-CL-${String(tnd).padStart(6, "0")}`;
  const ma = parseMaManualSerial(raw);
  if (ma != null) return `TND-CL-${String(ma).padStart(6, "0")}`;
  if (raw && !raw.toLowerCase().startsWith("manual-")) return raw;
  return stableProvisionalTndClFromDealerId(m.id);
}

/** @deprecated используйте getManualDealerDisplayCode */
export function manualDealerDisplayInternalCode(m: ManualDealer): string {
  return getManualDealerDisplayCode(m);
}

export function getManualTradePointDisplayCode(m: ManualTradePoint): string {
  const raw = (m.internalCode ?? "").trim();
  const tnd = parseTndTpSerial(raw);
  if (tnd != null) return `TND-TP-${String(tnd).padStart(6, "0")}`;
  const ma = parseMaManualSerial(raw);
  if (ma != null) return `TND-TP-${String(ma).padStart(6, "0")}`;
  if (raw && !raw.toLowerCase().startsWith("manual-")) return raw;
  return stableProvisionalTndTpFromTradePointId(m.id);
}

export type InnDuplicateMatch = {
  dealerId: string;
  name: string;
};

/** Поиск клиента с тем же ИНН (цифры) в merged-строках и ручных дилерах. */
export function findInnDuplicateInActualization(
  innRaw: string,
  mergedRows: DealerRow[],
  act: ActualizationState,
  excludeDealerId?: string,
): InnDuplicateMatch | null {
  const digits = normalizeInnDigits(innRaw);
  if (digits.length < 10) return null;

  for (const row of mergedRows) {
    if (excludeDealerId && row.id === excludeDealerId) continue;
    const rowInn = normalizeInnDigits(row.actualizationInn ?? "");
    if (rowInn && rowInn === digits) {
      return { dealerId: row.id, name: row.name };
    }
  }

  for (const m of Object.values(act.manuallyCreatedDealersById)) {
    if (excludeDealerId && m.id === excludeDealerId) continue;
    const f = (m.fields ?? {}) as Record<string, unknown>;
    const inn = typeof f.inn === "string" ? f.inn : "";
    if (normalizeInnDigits(inn) === digits) {
      const name = typeof f.name === "string" ? f.name : "Клиент";
      return { dealerId: m.id, name };
    }
  }

  return null;
}

export type NameCityDuplicateMatch = { dealerId: string; name: string };

/**
 * Нормализует имя клиента: lower, trim, схлоп пробелов, убрать пунктуацию.
 * Используется для сравнения «Бабич Элла Юрьевна ИП» == «Бабич, Элла  Юрьевна (ИП)».
 */
export function normalizeDealerNameForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»"'`,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type NameMatchCandidate = {
  dealerId: string;
  code: string | null;
  name: string;
  city: string;
  managerName: string;
  source: "release" | "manual";
};

function manualDealerManagerId(m: ManualDealer): string {
  const f = (m.fields ?? {}) as Record<string, unknown>;
  const releaseManagerId = typeof f.releaseManagerId === "string" ? f.releaseManagerId.trim() : "";
  const managerUserId = typeof f.managerUserId === "string" ? f.managerUserId.trim() : "";
  return releaseManagerId || managerUserId || "";
}

function manualDealerStringField(m: ManualDealer, key: string): string {
  const f = (m.fields ?? {}) as Record<string, unknown>;
  const v = f[key];
  return typeof v === "string" ? v.trim() : "";
}

function candidatePriority(normalizedName: string, q: string): number | null {
  if (normalizedName === q) return 0;
  if (normalizedName.startsWith(q)) return 1;
  if (normalizedName.includes(q)) return 2;
  return null;
}

/**
 * Поиск похожих клиентов по нормализованному имени в merged-строках (release + manual).
 * Возвращает ≤ limit совпадений, отсортированных: точное совпадение > prefix > substring.
 */
export function findDealerCandidatesByName(args: {
  nameQuery: string;
  mergedRows: DealerRow[];
  act?: ActualizationState;
  managerUserId?: string;
  excludeDealerId?: string;
  limit?: number;
}): NameMatchCandidate[] {
  const q = normalizeDealerNameForMatch(args.nameQuery);
  if (q.length < 3) return [];

  const seen = new Set<string>();
  const matches: Array<NameMatchCandidate & { priority: number }> = [];
  const push = (candidate: NameMatchCandidate, priority: number) => {
    if (args.excludeDealerId && candidate.dealerId === args.excludeDealerId) return;
    if (seen.has(candidate.dealerId)) return;
    seen.add(candidate.dealerId);
    matches.push({ ...candidate, priority });
  };

  for (const row of args.mergedRows) {
    if (args.managerUserId && row.releaseManagerId !== args.managerUserId) continue;
    const priority = candidatePriority(normalizeDealerNameForMatch(row.name), q);
    if (priority == null) continue;
    push(
      {
        dealerId: row.id,
        code: row.releaseCode?.trim() || null,
        name: row.name,
        city: row.city,
        managerName: row.manager,
        source: isManualActualizationDealerId(row.id) ? "manual" : "release",
      },
      priority,
    );
  }

  if (args.act) {
    for (const m of Object.values(args.act.manuallyCreatedDealersById)) {
      if (args.managerUserId && manualDealerManagerId(m) !== args.managerUserId) continue;
      const name = manualDealerStringField(m, "name") || manualDealerStringField(m, "dealerName");
      const priority = candidatePriority(normalizeDealerNameForMatch(name), q);
      if (priority == null) continue;
      push(
        {
          dealerId: m.id,
          code: getManualDealerDisplayCode(m),
          name: name || "Клиент",
          city: manualDealerStringField(m, "city"),
          managerName: manualDealerStringField(m, "manager"),
          source: "manual",
        },
        priority,
      );
    }
  }

  return matches
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "ru"))
    .slice(0, args.limit ?? 6)
    .map(({ priority: _priority, ...candidate }) => candidate);
}

/**
 * Поиск точного дубля по нормализованному имени в скоупе менеджера.
 * Возвращает первое совпадение или null.
 */
export function findExactNameDuplicateInActualization(
  nameRaw: string,
  mergedRows: DealerRow[],
  act: ActualizationState,
  managerUserId: string,
  excludeDealerId?: string,
): NameCityDuplicateMatch | null {
  const name = normalizeDealerNameForMatch(nameRaw);
  if (!name) return null;

  for (const row of mergedRows) {
    if (excludeDealerId && row.id === excludeDealerId) continue;
    if (row.releaseManagerId !== managerUserId) continue;
    if (normalizeDealerNameForMatch(row.name) === name) {
      return { dealerId: row.id, name: row.name };
    }
  }

  for (const m of Object.values(act.manuallyCreatedDealersById)) {
    if (excludeDealerId && m.id === excludeDealerId) continue;
    if (manualDealerManagerId(m) !== managerUserId) continue;
    const manualName = manualDealerStringField(m, "name") || manualDealerStringField(m, "dealerName");
    if (normalizeDealerNameForMatch(manualName) === name) {
      return { dealerId: m.id, name: manualName || "Клиент" };
    }
  }

  return null;
}

export function findNameCityDuplicateInActualization(
  nameRaw: string,
  cityRaw: string,
  mergedRows: DealerRow[],
  act: ActualizationState,
  excludeDealerId?: string,
): NameCityDuplicateMatch | null {
  const name = nameRaw.trim().toLowerCase();
  const city = cityRaw.trim().toLowerCase();
  if (!name || !city) return null;

  for (const row of mergedRows) {
    if (excludeDealerId && row.id === excludeDealerId) continue;
    if (row.name.trim().toLowerCase() === name && row.city.trim().toLowerCase() === city) {
      return { dealerId: row.id, name: row.name };
    }
  }

  for (const m of Object.values(act.manuallyCreatedDealersById)) {
    if (excludeDealerId && m.id === excludeDealerId) continue;
    const f = (m.fields ?? {}) as Record<string, unknown>;
    const n = typeof f.name === "string" ? f.name.trim().toLowerCase() : "";
    const c = typeof f.city === "string" ? f.city.trim().toLowerCase() : "";
    if (n === name && c === city) {
      return { dealerId: m.id, name: typeof f.name === "string" ? f.name : "Клиент" };
    }
  }

  return null;
}
