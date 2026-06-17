/**
 * Локальный справочник юрлиц / клиентов для подсказок и поиска по ИНН (без внешних API).
 */

import { getCatalogDealerRows } from "./dealer-base-source.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { getMergedDealerLegalEntities, loadDealerLegalEntitiesState } from "./dealer-legal-entities.js";
import { getPassportLegalEntities } from "./dealer-card-release-signals.js";

export type LegalEntitySuggestion = {
  id: string;
  name: string;
  inn?: string;
  kpp?: string;
  legalAddress?: string;
  /** Откуда взята запись (для отладки / UI). */
  source: "stored" | "passport" | "dealer_name";
};

export function isValidInnDigits(inn: string): boolean {
  const d = inn.replace(/\D/g, "");
  return d.length === 10 || d.length === 12;
}

export type LegalEntityInnLookupResult = {
  id: string;
  name: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  legalAddress?: string;
  source: string;
};

/**
 * Поиск по ИНН только в локальных данных (юрлица всех дилеров + паспорт).
 * Внешние сервисы не вызываются.
 */
export function lookupLegalEntityByInn(
  innRaw: string,
  rows: DealerRow[] = getCatalogDealerRows(),
): { ok: true; results: LegalEntityInnLookupResult[] } | { ok: false; error: string } {
  const inn = innRaw.replace(/\D/g, "");
  if (!inn) return { ok: false, error: "Введите ИНН." };
  if (!isValidInnDigits(inn)) {
    return { ok: false, error: "ИНН должен содержать 10 или 12 цифр." };
  }
  const state = loadDealerLegalEntitiesState();
  const results: LegalEntityInnLookupResult[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const merged = getMergedDealerLegalEntities(row, state);
    for (const e of merged) {
      const eInn = (e.inn ?? "").replace(/\D/g, "");
      if (!eInn || eInn !== inn) continue;
      const key = `${row.id}:${e.id}:${eInn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        id: `${row.id}::${e.id}`,
        name: e.name,
        inn: eInn,
        kpp: e.kpp,
        legalAddress: e.legalAddress,
        source: `Дилер: ${row.name}`,
      });
    }
  }

  return { ok: true, results };
}

function pushSuggestion(out: LegalEntitySuggestion[], seen: Set<string>, s: LegalEntitySuggestion) {
  const k = `${s.name.trim().toLowerCase()}|${(s.inn ?? "").trim()}`;
  if (seen.has(k)) return;
  seen.add(k);
  out.push(s);
}

/** Подсказки по названию (≥2 символа). */
export function buildLegalEntityNameSuggestions(
  query: string,
  currentDealerId: string,
  rows: DealerRow[] = getCatalogDealerRows(),
): LegalEntitySuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const state = loadDealerLegalEntitiesState();
  const out: LegalEntitySuggestion[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.name.trim().toLowerCase().includes(q)) {
      pushSuggestion(out, seen, {
        id: `dealer:${row.id}`,
        name: row.name.trim(),
        source: "dealer_name",
      });
    }
    const merged = getMergedDealerLegalEntities(row, state);
    for (const e of merged) {
      if (!e.name.trim().toLowerCase().includes(q)) continue;
      pushSuggestion(out, seen, {
        id: row.id === currentDealerId ? `le:${e.id}` : `other:${row.id}:${e.id}`,
        name: e.name.trim(),
        inn: e.inn,
        kpp: e.kpp,
        legalAddress: e.legalAddress,
        source: "stored",
      });
    }
    for (const p of getPassportLegalEntities(row)) {
      if (!p.name.trim().toLowerCase().includes(q)) continue;
      pushSuggestion(out, seen, {
        id: `passport:${row.id}:${p.legalEntityId}`,
        name: p.name.trim(),
        source: "passport",
      });
    }
  }

  return out.slice(0, 24);
}
