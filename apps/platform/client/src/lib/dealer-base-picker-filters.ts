/**
 * Фильтры списка клиентской базы (поиск, быстрые фильтры, РОП/менеджер).
 * Общий модуль для страницы /dealer-base и счётчика в навигации.
 */

import type { ClientCategoryId } from "./client-category.js";
import { clientCategoryMatchesFilter, isClientTopTier } from "./client-category.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { getDealerRopDisplay } from "./dealer-base-mock-data.js";
import { getDealerRegionalManagerEffectiveDisplay } from "./dealer-regional-manager-overrides.js";
import { isRopOrManagerAllFilter, managerDisplayMatchesCatalogName } from "./rop-manager-filters.js";
import type { SalesUser } from "./sales-control-data.js";

import { rowMatchesGeoFilters } from "./dealer-base-geo-parse.js";

export type QuickFilter = "all" | "active" | "potential" | "attention" | "top" | "no_activity" | "closed";

type ClientCategoryRouteFilter = ClientCategoryId | "all" | "__top_tier__";
export type ClientCategorySelection = Exclude<ClientCategoryRouteFilter, "all">;

export type DealerBasePickerArgs = {
  search: string;
  quick: QuickFilter;
  cities: string[];
  categories: ClientCategorySelection[];
  ropTeam: string;
  /** Подпись выбранной команды РОП (ФИО) — fallback при UUID в real-режиме. */
  ropTeamLabel?: string;
  manager: string;
  managerCatalogForRop: SalesUser[];
  /** Пустая строка — без фильтра */
  geoRegion: string;
  geoDistrict: string;
  geoLocality: string;
};

export function applyQuickFilter(row: DealerRow, q: QuickFilter): boolean {
  switch (q) {
    case "all":
      return row.status !== "приостановлен";
    case "active":
      return row.status === "активный";
    case "potential":
      return row.status === "потенциальный";
    case "attention":
      return row.status === "требует внимания" || row.hasProblem;
    case "top":
      return isClientTopTier(row.clientCategory);
    case "no_activity":
      return !row.hasRecentActivity;
    case "closed":
      return row.status === "приостановлен";
    default:
      return true;
  }
}

export function applyDealerBasePickerFilters(rows: DealerRow[], args: DealerBasePickerArgs): DealerRow[] {
  const q = args.search.trim().toLowerCase();
  const qDigits = q ? q.replace(/\D/g, "") : "";
  const citySet = args.cities.length > 0 ? new Set(args.cities) : null;
  const categorySelections = args.categories;
  return rows.filter((row) => {
    if (!applyQuickFilter(row, args.quick)) return false;
    if (citySet && !citySet.has(row.city)) return false;
    if (categorySelections.length > 0) {
      const ok = categorySelections.some((c) => clientCategoryMatchesFilter(row.clientCategory, c));
      if (!ok) return false;
    }
    if (!rowMatchesGeoFilters(row, args.geoRegion, args.geoDistrict, args.geoLocality)) return false;
    if (!isRopOrManagerAllFilter(args.ropTeam)) {
      let ropOk = row.releaseTeamId === args.ropTeam;
      if (!ropOk && args.ropTeamLabel) {
        ropOk = managerDisplayMatchesCatalogName(getDealerRopDisplay(row), args.ropTeamLabel);
      }
      if (!ropOk) return false;
    }
    if (!isRopOrManagerAllFilter(args.manager)) {
      let mgrOk = row.releaseManagerId === args.manager;
      if (!mgrOk) {
        const cat = args.managerCatalogForRop.find((m) => m.id === args.manager);
        mgrOk = Boolean(cat && managerDisplayMatchesCatalogName(row.manager, cat.name));
      }
      if (!mgrOk) return false;
    }
    if (!q) return true;
    const innRaw = row.actualizationInn ?? "";
    const innDigits = innRaw.replace(/\D/g, "");
    const hay = [
      row.name,
      row.city,
      row.manager,
      getDealerRegionalManagerEffectiveDisplay(row),
      getDealerRopDisplay(row),
      row.releaseCode ?? "",
      row.external1cCode ?? "",
      row.releaseAddress ?? "",
      row.clientTypeLabel ?? "",
      row.id,
      innRaw,
      innDigits,
    ]
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) return true;
    return Boolean(qDigits && innDigits && innDigits.includes(qDigits));
  });
}
