import { useMemo } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import { useTeamContext } from "@/hooks/use-team-context";
import { useTrashFromDb } from "@/hooks/use-trash-from-db";
import { buildTrashScopeFilter, splitScopedTrashCounts } from "@/lib/dealer-trash-scope";

export type ScopedTrashCounts = {
  /** Кол-во клиентов (дилеров) в корзине в scope пользователя. null = ещё грузится, undefined = выключено. */
  dealers: number | null | undefined;
  tradePoints: number | null | undefined;
  loading: boolean;
};

/**
 * Числа корзины в scope пользователя — ровно то, что показывает страница /trash.
 * Источник: useTrashFromDb + buildTrashScopeFilter (RBAC). Используется и в сайдбаре (бейдж),
 * и на странице корзины, чтобы числа всегда совпадали для всех ролей.
 */
export function useScopedTrashCounts(enabled = true): ScopedTrashCounts {
  const { user } = useAuthUser();
  const { profile } = useReleaseDemoProfile();
  const realScope = useSidebarNavRealScope(enabled);
  const { teamContext } = useTeamContext(enabled);
  const trashFromDb = useTrashFromDb(enabled && Boolean(user?.id));

  const filter = useMemo(
    () =>
      buildTrashScopeFilter({
        role: user?.role ?? null,
        profile,
        realScope,
        userId: user?.id ?? null,
        teamContext,
      }),
    [user?.role, user?.id, profile, realScope, teamContext],
  );

  return useMemo(() => {
    if (!enabled || !user?.id) {
      return { dealers: undefined, tradePoints: undefined, loading: false };
    }
    if (trashFromDb.loading) {
      return { dealers: null, tradePoints: null, loading: true };
    }
    const { dealers, tradePoints } = splitScopedTrashCounts(
      trashFromDb.dealers,
      trashFromDb.tradePoints,
      filter,
    );
    return { dealers, tradePoints, loading: false };
  }, [enabled, user?.id, trashFromDb.loading, trashFromDb.dealers, trashFromDb.tradePoints, filter]);
}
