/**
 * Права на режим актуализации клиентской базы (демо-профиль, без серверной RBAC).
 */

import type { UserRole } from "@shared/auth";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED,
  CLIENT_BASE_ACTUALIZATION_ENABLED,
} from "@/lib/client-base-actualization-config";

function actualizationUnlocked(): boolean {
  return CLIENT_BASE_ACTUALIZATION_ENABLED;
}

/** Может ли роль участвовать в актуализации (не маркетолог / не аналитик). */
export function canActualizeClientBase(profile: ReleaseDemoProfile, authRole?: UserRole | null): boolean {
  if (!actualizationUnlocked()) return false;
  if (authRole === "admin") return true;
  const r = profile.role as ReleaseDemoProfile["role"] | "admin";
  if (r === "marketer" || r === "analyst") return false;
  return r === "sales_manager" || r === "team_lead" || r === "sales_director" || r === "admin";
}

/** Создание нового клиента (будет назначен на текущего менеджера в следующих PR). */
export function canCreateDealerDuringActualization(
  profile: ReleaseDemoProfile,
  authRole?: UserRole | null,
): boolean {
  if (!canActualizeClientBase(profile, authRole)) return false;
  const r = profile.role as ReleaseDemoProfile["role"] | "admin";
  return (
    authRole === "admin" ||
    r === "sales_manager" ||
    r === "team_lead" ||
    r === "sales_director" ||
    r === "admin"
  );
}

export function canEditDealerDuringActualization(
  profile: ReleaseDemoProfile,
  dealer: DealerRow,
  authRole?: UserRole | null,
): boolean {
  if (!canActualizeClientBase(profile, authRole)) return false;
  return canEditClientNextStep(profile, dealer, authRole);
}

/** Мягкое архивирование клиента (скрытие из рабочей базы) — те же границы ответственности, что и правка. */
export function canArchiveDealerDuringActualization(
  profile: ReleaseDemoProfile,
  dealer: DealerRow,
  authRole?: UserRole | null,
): boolean {
  return canEditDealerDuringActualization(profile, dealer, authRole);
}

/** Алиас: менеджер — свои клиенты, РОП — команда, директор — все; маркетолог/аналитик — нет. */
export function canArchiveDealer(
  profile: ReleaseDemoProfile,
  dealer: DealerRow,
  authRole?: UserRole | null,
): boolean {
  return canArchiveDealerDuringActualization(profile, dealer, authRole);
}

export function canCreateTradePointDuringActualization(
  profile: ReleaseDemoProfile,
  dealer: DealerRow,
  authRole?: UserRole | null,
): boolean {
  return canEditDealerDuringActualization(profile, dealer, authRole);
}

export function canEditTradePointDuringActualization(
  profile: ReleaseDemoProfile,
  dealer: DealerRow,
  _tradePoint: DealerTradePoint,
  authRole?: UserRole | null,
): boolean {
  void _tradePoint;
  return canEditDealerDuringActualization(profile, dealer, authRole);
}

/** Архив / закрытие ТТ: менеджеры — только при feature flag; РОП и директор — при праве редактирования клиента. */
export function canArchiveTradePointDuringActualization(
  profile: ReleaseDemoProfile,
  dealer: DealerRow,
  _tradePoint: DealerTradePoint,
  authRole?: UserRole | null,
): boolean {
  if (!canEditTradePointDuringActualization(profile, dealer, _tradePoint, authRole)) return false;
  const r = profile.role as ReleaseDemoProfile["role"] | "admin";
  if (authRole === "admin" || r === "sales_director" || r === "admin" || profile.role === "team_lead") return true;
  if (profile.role === "sales_manager") {
    return CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED;
  }
  return false;
}

export function canManageLegalEntitiesDuringActualization(
  profile: ReleaseDemoProfile,
  dealer: DealerRow,
  authRole?: UserRole | null,
): boolean {
  return canEditDealerDuringActualization(profile, dealer, authRole);
}
