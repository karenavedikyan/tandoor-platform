/**
 * Рабочие признаки участия клиента в коммерческих программах для пилотной фильтрации:
 * - Спецусловия (индивидуальные коммерческие условия)
 * - Tandoor Club (программа лояльности)
 * - Мотивация / кешбек агента (агентское вознаграждение)
 *
 * Источники:
 * 1) Поля `row.terms.*` (если в данных уже отмечено явное участие).
 * 2) Детерминированный фолбэк от характеристик клиента (категория, активность, id) — без Math.random,
 *    чтобы списки были стабильны между перерендерами и не зависели от рантайма.
 */

import type { ClientCategoryId } from "@/lib/client-category";
import { isClientTopTier } from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerCharacteristicValue } from "@/lib/dealer-characteristics";

export type DealerProgramSignal = {
  hasSpecialConditions: boolean;
  hasTandoorClub: boolean;
  hasCashbackAgent: boolean;
};

export type DealerProgramFilterId =
  | "special_conditions"
  | "tandoor_club"
  | "cashback_agent";

export const DEALER_PROGRAM_FILTER_LABELS: Record<DealerProgramFilterId, string> = {
  special_conditions: "Спецусловия",
  tandoor_club: "Tandoor Club",
  cashback_agent: "Кешбек агент",
};

export const DEALER_PROGRAM_FILTER_BADGE_TESTID: Record<DealerProgramFilterId, string> = {
  special_conditions: "badge-dealer-special-conditions",
  tandoor_club: "badge-dealer-tandoor-club",
  cashback_agent: "badge-dealer-cashback-agent",
};

export const DEALER_PROGRAM_FILTER_BUTTON_TESTID: Record<DealerProgramFilterId, string> = {
  special_conditions: "filter-special-conditions",
  tandoor_club: "filter-tandoor-club",
  cashback_agent: "filter-cashback-agents",
};

const CAT_WEIGHT: Record<ClientCategoryId, number> = {
  top150: 11,
  top350: 13,
  top500: 17,
  top500plus: 19,
  potential: 31,
  lead: 41,
  no_sales: 43,
  uncategorized: 47,
};

function charSum(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) n += s.charCodeAt(i);
  return n;
}

function looksAffirmative(raw: string | undefined): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t || t === "—" || t === "-" || t === "нет" || t === "no") return false;
  return (
    t.includes("участник") ||
    t.includes("да") ||
    t.includes("есть") ||
    t.includes("действуют") ||
    t.includes("активн") ||
    t.includes("кешб") ||
    t.includes("cash") ||
    t.includes("мотив") ||
    t.includes("+") ||
    t.includes("спец")
  );
}

function deterministicHash(row: DealerRow): number {
  const cat = CAT_WEIGHT[row.clientCategory] ?? 0;
  return (
    charSum(row.id) +
    charSum(row.name) * 3 +
    charSum(row.city) +
    cat * 7
  );
}

/**
 * Стабильно отмечает примерно треть активных клиентов как имеющих спецусловия:
 * приоритет — TOP-сегмент и активные клиенты.
 */
function fallbackSpecialConditions(row: DealerRow): boolean {
  if (row.status === "приостановлен") return false;
  const h = deterministicHash(row);
  if (isClientTopTier(row.clientCategory)) return h % 3 !== 0;
  if (row.status === "активный") return h % 4 === 1;
  return false;
}

/**
 * Tandoor Club — программа для значимых партнёров. Включает TOP-сегмент и часть «500+» активных.
 */
function fallbackTandoorClub(row: DealerRow): boolean {
  if (row.status === "приостановлен") return false;
  if (isClientTopTier(row.clientCategory)) return true;
  if (row.clientCategory === "top500plus" && row.status === "активный") {
    return deterministicHash(row) % 3 === 0;
  }
  return false;
}

/**
 * Кешбек агента / мотивация — выплачивается активным агентам в TOP-сегменте и отдельной части активных «500+».
 */
function fallbackCashbackAgent(row: DealerRow): boolean {
  if (row.status !== "активный") return false;
  if (isClientTopTier(row.clientCategory)) {
    return deterministicHash(row) % 2 === 0;
  }
  if (row.clientCategory === "top500plus") {
    return deterministicHash(row) % 5 === 0;
  }
  return false;
}

export function getDealerProgramSignal(row: DealerRow): DealerProgramSignal {
  const t = row.terms;
  const explicitClub = t.tandoorClub === "Участник" || looksAffirmative(t.tandoorClub);
  const explicitSpecial = looksAffirmative(t.special);
  const explicitCashback = looksAffirmative(t.bonuses);

  const ovSpecial = getDealerCharacteristicValue(row.id, "has_special_conditions");
  const ovClub = getDealerCharacteristicValue(row.id, "has_tandoor_club");
  const ovCashback = getDealerCharacteristicValue(row.id, "has_cashback_agent");

  const hasSpecial =
    ovSpecial === "yes"
      ? true
      : ovSpecial === "no"
        ? false
        : explicitSpecial || fallbackSpecialConditions(row);
  const hasClub =
    ovClub === "yes"
      ? true
      : ovClub === "no"
        ? false
        : explicitClub || fallbackTandoorClub(row);
  const hasCashback =
    ovCashback === "yes"
      ? true
      : ovCashback === "no"
        ? false
        : explicitCashback || fallbackCashbackAgent(row);

  return {
    hasSpecialConditions: hasSpecial,
    hasTandoorClub: hasClub,
    hasCashbackAgent: hasCashback,
  };
}

export function dealerRowMatchesProgramFilters(
  row: DealerRow,
  selected: DealerProgramFilterId[],
): boolean {
  if (selected.length === 0) return true;
  const s = getDealerProgramSignal(row);
  for (const f of selected) {
    if (f === "special_conditions" && !s.hasSpecialConditions) return false;
    if (f === "tandoor_club" && !s.hasTandoorClub) return false;
    if (f === "cashback_agent" && !s.hasCashbackAgent) return false;
  }
  return true;
}
