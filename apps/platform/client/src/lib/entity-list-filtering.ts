import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

export type EntityListFilterOption = { value: string; label: string };

/** Нормализация строки для fuzzy-поиска: lower, без диакритики, схлопывание пробелов. */
export function normalizeForSearch(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLocaleLowerCase("ru")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ёЁ]/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

/** Совпадение поисковой строки по нескольким полям (любое совпадение → true). */
export function matchesSearch(query: string, fields: Array<string | null | undefined>): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  for (const f of fields) {
    const v = normalizeForSearch(f);
    if (v.includes(q)) return true;
  }
  return false;
}

/** Сколько select-фильтров активно (value !== "all"). Поиск считается отдельно. */
export function countActiveEntityListFilters(values: string[]): number {
  return values.filter((v) => v !== "all").length;
}

/** Сборка списка опций «город» из строк с полем city. */
export function buildCityOptionsFromRows<T extends { city?: string | null }>(
  rows: readonly T[],
): EntityListFilterOption[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const c = (r.city ?? "").trim();
    if (!c) continue;
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  const items = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([city, count]) => ({ value: city, label: `${city} (${count})` }));
  return [{ value: "all", label: "Все города" }, ...items];
}

/** Сборка опций «категория» из текущего набора строк (только встречающиеся). */
export function buildCategoryOptionsFromRows<T extends { clientCategory?: ClientCategoryId }>(
  rows: readonly T[],
  labelFor: (id: ClientCategoryId) => string,
): EntityListFilterOption[] {
  const set = new Set<ClientCategoryId>();
  for (const r of rows) if (r.clientCategory) set.add(r.clientCategory);
  const items = Array.from(set)
    .sort()
    .map((id) => ({ value: id, label: labelFor(id) }));
  return [{ value: "all", label: "Все категории" }, ...items];
}

/** Опции менеджера для страницы города (каталог id + имя). */
export function buildManagerOptionsFromCityManagers(
  managers: ReadonlyArray<{ managerCatalogId: string; managerName: string; activeClients: number }>,
): EntityListFilterOption[] {
  const items = managers
    .slice()
    .sort((a, b) => a.managerName.localeCompare(b.managerName, "ru"))
    .map((m) => ({
      value: m.managerCatalogId,
      label: `${m.managerName} (${m.activeClients})`,
    }));
  return [{ value: "all", label: "Все менеджеры" }, ...items];
}

/** Опции менеджера по полю manager в строках ТТ (строковое имя). */
export function buildManagerNameOptionsFromRows<T extends { manager?: string | null }>(
  rows: readonly T[],
): EntityListFilterOption[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const m = (r.manager ?? "").trim();
    if (!m) continue;
    map.set(m, (map.get(m) ?? 0) + 1);
  }
  const items = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([name, count]) => ({ value: name, label: `${name} (${count})` }));
  return [{ value: "all", label: "Все менеджеры" }, ...items];
}

export type { DealerRow };
