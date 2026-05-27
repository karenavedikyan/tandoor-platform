/**
 * Рабочие признаки участия клиента в коммерческих программах для пилотной фильтрации:
 * - Спецусловия (индивидуальные коммерческие условия)
 * - Франшиза (редактируемая характеристика + фолбэк)
 * - Tandoor Club (программа лояльности)
 * - Тандор Бонус (агентское вознаграждение)
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
import { isManualActualizationDealerId } from "@/lib/client-base-actualization-stable-ids";

export type DealerProgramSignal = {
  hasSpecialConditions: boolean;
  hasFranchise: boolean;
  hasTandoorClub: boolean;
  hasCashbackAgent: boolean;
};

export type DealerProgramFilterId =
  | "special_conditions"
  | "franchise"
  | "tandoor_club"
  | "cashback_agent";

/** Порядок чипов «Признаки» в клиентской базе. */
export const DEALER_PROGRAM_FILTER_ORDER: readonly DealerProgramFilterId[] = [
  "special_conditions",
  "franchise",
  "tandoor_club",
  "cashback_agent",
];

export const DEALER_PROGRAM_FILTER_LABELS: Record<DealerProgramFilterId, string> = {
  special_conditions: "Спецусловия",
  franchise: "Франшиза",
  tandoor_club: "Tandoor Club",
  cashback_agent: "Тандор Бонус",
};

export const DEALER_PROGRAM_FILTER_BADGE_TESTID: Record<DealerProgramFilterId, string> = {
  special_conditions: "badge-dealer-special-terms",
  franchise: "badge-dealer-franchise",
  tandoor_club: "badge-dealer-tandoor-club",
  cashback_agent: "badge-dealer-cashback-client",
};

export const DEALER_PROGRAM_FILTER_BUTTON_TESTID: Record<DealerProgramFilterId, string> = {
  special_conditions: "filter-special-conditions",
  franchise: "button-dealer-program-filter-franchise",
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
 * Тандор Бонус / мотивация — выплачивается активным агентам в TOP-сегменте и отдельной части активных «500+».
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

function textHintsFranchise(row: DealerRow): boolean {
  const pool = [
    row.terms.special,
    row.terms.payment,
    row.terms.bonuses,
    row.terms.edo,
    row.terms.limit,
    row.name,
    row.legalEntity,
    row.holding,
    row.comment,
  ]
    .map((x) => (x ?? "").toLowerCase())
    .join(" ");
  return pool.includes("франш");
}

function fallbackFranchise(row: DealerRow): boolean {
  if (row.status === "приостановлен") return false;
  const h = deterministicHash(row);
  if (row.format === "сетевой" && row.status === "активный") return h % 6 === 2;
  if (row.status === "активный" && isClientTopTier(row.clientCategory)) return h % 11 === 3;
  return false;
}

export function getDealerProgramSignal(row: DealerRow): DealerProgramSignal {
  const t = row.terms;

  if (isManualActualizationDealerId(row.id)) {
    return {
      hasSpecialConditions: row.hasSpecialTerms === true,
      hasFranchise: false,
      hasTandoorClub: row.isTandoorClubMember === true,
      hasCashbackAgent: row.isCashbackClient === true,
    };
  }

  const actSpecial = row.hasSpecialTerms;
  const actClub = row.isTandoorClubMember;
  const actCash = row.isCashbackClient;

  const explicitClub = t.tandoorClub === "Участник" || looksAffirmative(t.tandoorClub);
  const explicitSpecial = looksAffirmative(t.special);
  const explicitCashback = looksAffirmative(t.bonuses);

  const ovSpecial = getDealerCharacteristicValue(row.id, "has_special_conditions");
  const ovFranchise = getDealerCharacteristicValue(row.id, "is_franchise");
  const ovClub = getDealerCharacteristicValue(row.id, "has_tandoor_club");
  const ovCashback = getDealerCharacteristicValue(row.id, "has_cashback_agent");

  const hasSpecial =
    actSpecial === true
      ? true
      : actSpecial === false
        ? false
        : ovSpecial === "yes"
          ? true
          : ovSpecial === "no"
            ? false
            : explicitSpecial || fallbackSpecialConditions(row);
  const hasFranchise =
    ovFranchise === "yes"
      ? true
      : ovFranchise === "no"
        ? false
        : textHintsFranchise(row) || fallbackFranchise(row);
  const hasClub =
    actClub === true
      ? true
      : actClub === false
        ? false
        : ovClub === "yes"
          ? true
          : ovClub === "no"
            ? false
            : explicitClub || fallbackTandoorClub(row);
  const hasCashback =
    actCash === true
      ? true
      : actCash === false
        ? false
        : ovCashback === "yes"
          ? true
          : ovCashback === "no"
            ? false
            : explicitCashback || fallbackCashbackAgent(row);

  return {
    hasSpecialConditions: hasSpecial,
    hasFranchise,
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
    if (f === "franchise" && !s.hasFranchise) return false;
    if (f === "tandoor_club" && !s.hasTandoorClub) return false;
    if (f === "cashback_agent" && !s.hasCashbackAgent) return false;
  }
  return true;
}
