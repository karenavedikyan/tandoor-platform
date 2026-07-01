/**
 * Единая логика фильтров «РОП (команда) + менеджер» на основе справочников sales-control-data.
 * Сопоставление ФИО из Excel/моков с каталогом менеджеров — устойчивое к вариантам написания.
 */

import {
  getAllSalesManagers,
  getTeamLeadForTeam,
  getTeamManagers,
  SALES_TEAMS,
  type SalesUser,
} from "./sales-control-data.js";

/** Значение «все» в селектах (совместимо с release-clients ALL и dealer-base "all"). */
export function isRopOrManagerAllFilter(v: string | undefined): boolean {
  return !v || v === "all" || v === "__all__";
}

export type RopSelectOption = {
  teamId: string;
  /** Подпись в UI — ФИО РОПа */
  label: string;
};

/** РОПы = команды; подпись — руководитель команды из справочника. */
export function getRopOptions(): RopSelectOption[] {
  return SALES_TEAMS.map((t) => {
    const lead = getTeamLeadForTeam(t.id);
    return { teamId: t.id, label: lead?.name ?? t.name };
  });
}

/** Менеджеры команды РОПа; при «все команды» — все менеджеры из справочника. */
export function getManagersForRopTeam(teamId: string | undefined): SalesUser[] {
  if (isRopOrManagerAllFilter(teamId)) return getAllSalesManagers();
  return getTeamManagers(teamId as string);
}

export function normalizePersonTokens(s: string): string[] {
  const t = s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Za-zА-Яа-яЁё0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.split(" ").filter(Boolean);
}

export function managerDisplayMatchesCatalogName(displayName: string, catalogName: string): boolean {
  const a = normalizePersonTokens(displayName);
  const b = normalizePersonTokens(catalogName);
  if (a.length === 0 || b.length === 0) return false;
  const joinA = a.join(" ");
  const joinB = b.join(" ");
  if (joinA === joinB) return true;
  if (joinA.includes(joinB) || joinB.includes(joinA)) return true;
  // Фамилия + частичное совпадение имени (Бойко Катерина vs Бойко Екатерина Михайловна)
  if (a[0] === b[0]) {
    const fnA = a[1] ?? "";
    const fnB = b[1] ?? "";
    if (fnA && fnB) {
      if (fnA.slice(0, 3) === fnB.slice(0, 3)) return true;
      if (fnA[0] === fnB[0] && (fnA.length <= 2 || fnB.length <= 2 || joinA.includes(fnB.slice(0, 4)) || joinB.includes(fnA.slice(0, 4))))
        return true;
    }
  }
  const setA = new Set(a);
  let overlap = 0;
  for (const x of b) {
    if (setA.has(x)) overlap += 1;
  }
  return overlap >= 2;
}

/** Строгое совпадение нормализованного ФИО (без частичных совпадений). */
export function managerDisplayMatchesCatalogNameStrict(displayName: string, catalogName: string): boolean {
  const a = normalizePersonTokens(displayName);
  const b = normalizePersonTokens(catalogName);
  if (a.length === 0 || b.length === 0) return false;
  return a.join(" ") === b.join(" ");
}

export function resolveManagerUserFromDisplayName(displayName: string): SalesUser | undefined {
  const trimmed = displayName?.trim();
  if (!trimmed || trimmed === "—") return undefined;
  return getAllSalesManagers().find((m) => managerDisplayMatchesCatalogName(trimmed, m.name));
}

export function resolveTeamIdFromRopDisplayName(ropName: string): string | undefined {
  const trimmed = ropName?.trim();
  if (!trimmed || trimmed === "—") return undefined;
  for (const opt of getRopOptions()) {
    if (managerDisplayMatchesCatalogName(trimmed, opt.label)) return opt.teamId;
  }
  return undefined;
}

export function managerDisplayBelongsToRopTeam(managerDisplay: string, ropTeamId: string): boolean {
  if (isRopOrManagerAllFilter(ropTeamId)) return true;
  const u = resolveManagerUserFromDisplayName(managerDisplay);
  return Boolean(u && u.teamId === ropTeamId);
}

export function managerBelongsToRopTeam(managerId: string | undefined, managerDisplay: string | undefined, teamId: string): boolean {
  if (isRopOrManagerAllFilter(teamId)) return true;
  if (managerId) {
    const u = getAllSalesManagers().find((m) => m.id === managerId);
    return Boolean(u && u.teamId === teamId);
  }
  return managerDisplayBelongsToRopTeam(managerDisplay ?? "", teamId);
}

export function managerIdAllowedForRop(managerId: string, ropTeamId: string): boolean {
  if (isRopOrManagerAllFilter(managerId)) return true;
  return managerBelongsToRopTeam(managerId, undefined, ropTeamId);
}

export type RopManagerRowPickers<T> = {
  teamId?: (row: T) => string | undefined;
  managerId?: (row: T) => string | undefined;
  managerDisplay?: (row: T) => string | undefined;
};

/** Универсальная фильтрация: РОП = команда, менеджер = id или сопоставление по display. */
export function filterByRopAndManager<T>(
  rows: T[],
  ropTeamId: string,
  managerId: string,
  pick: RopManagerRowPickers<T>,
): T[] {
  return rows.filter((row) => {
    if (!isRopOrManagerAllFilter(ropTeamId)) {
      const tid = pick.teamId?.(row);
      if (tid && tid !== ropTeamId) return false;
      if (!tid && pick.managerDisplay) {
        const md = pick.managerDisplay(row) ?? "";
        if (!managerDisplayBelongsToRopTeam(md, ropTeamId)) return false;
      }
    }
    if (!isRopOrManagerAllFilter(managerId)) {
      const mid = pick.managerId?.(row);
      if (mid && mid === managerId) return true;
      const disp = pick.managerDisplay?.(row);
      if (disp) {
        const u = resolveManagerUserFromDisplayName(disp);
        return u?.id === managerId;
      }
      return false;
    }
    return true;
  });
}
