/**
 * Число клиентов в рабочей базе для бейджа навигации — та же логика, что у KPI «Всего»
 * на /dealer-base при фильтрах по умолчанию (без архива, с учётом актуализации).
 */

import type { UserRole } from "@shared/auth";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { countDealerBaseHeaderTotal } from "@/lib/dealer-base-working-rows";
import { mergeTrashedDealersForUi, mergeTrashedTradePointsForUi } from "@/lib/dealer-overrides-runtime";
import { buildTrashScopeFilter, countScopedTrashItems } from "@/lib/dealer-trash-scope";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";

export type SidebarDealerClientCountContext = {
  /** Как в ClientBaseActualizationProvider: false для маркетолога/аналитика и при выключенной фиче. */
  enabled: boolean;
  /** Первичная загрузка / refresh актуализации — не показываем устаревшее число. */
  loading: boolean;
  state: ActualizationState;
  /**
   * Для РОП/директора: объединённый team state (как на /dealer-base).
   * Если не передан, для расчёта используется только `state` (слой текущего пользователя).
   */
  managementDisplayState?: ActualizationState;
  /** Пока тянем state менеджеров команды — не показываем частичный счётчик в навигации. */
  managementTeamFetchLoading?: boolean;
  /** Real-режим: релиз-сид + org scope (как на /dealer-base). */
  realScope?: SidebarNavRealScope;
  /** Платформенная роль — для скоупа корзины (Промт 336). */
  role?: UserRole | null;
};

/**
 * @returns количество клиентов в рабочей базе или `null`, пока актуализация загружается (enabled && loading).
 */
export function resolveSidebarWorkingDealerClientCount(
  profile: ReleaseDemoProfile,
  ctx: SidebarDealerClientCountContext,
): number | null {
  if (ctx.enabled && ctx.loading) return null;
  if (ctx.enabled && ctx.managementTeamFetchLoading) return null;

  return countDealerBaseHeaderTotal({
    profile,
    actEnabled: ctx.enabled,
    actState: ctx.managementDisplayState ?? ctx.state,
    realScope: ctx.realScope,
  });
}

/**
 * Промт 46: счётчик содержимого Корзины для бейджа nav-item «Корзина».
 * Видимость:
 *   - если есть `managementDisplayState` (rop/director/admin) — считаем по нему;
 *   - иначе (manager) — по `ctx.state` (свой scope).
 *
 * Возвращает `null` пока актуализация / team merge ещё грузятся (как и обычный счётчик).
 */
export function resolveSidebarTrashCount(
  profile: ReleaseDemoProfile,
  ctx: SidebarDealerClientCountContext,
): number | null {
  if (!ctx.enabled) return null;
  if (ctx.loading) return null;
  if (ctx.managementTeamFetchLoading) return null;
  const act = ctx.managementDisplayState ?? ctx.state;
  const dealers = mergeTrashedDealersForUi(act);
  const tps = mergeTrashedTradePointsForUi(act);
  const filter = buildTrashScopeFilter({
    role: ctx.role ?? null,
    profile,
    realScope: ctx.realScope,
  });
  return countScopedTrashItems(dealers, tps, filter);
}
