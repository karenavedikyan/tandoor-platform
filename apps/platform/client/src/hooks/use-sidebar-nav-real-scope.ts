import { useEffect, useMemo } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useMyScopeFromDB } from "@/hooks/use-my-scope-from-db";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import { useDealerBaseRows } from "@/lib/dealer-base-source";
import { buildSidebarNavRealScope, type SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";

/**
 * Real-scope для списков /dealer-base, /trade-points (Промт 384).
 * Строки каталога фильтруются по active_dealer_external_keys из GET /api/dealers/my-scope.
 */
export function useSidebarNavRealScope(enabled = true): SidebarNavRealScope {
  const { user: me, isLoading: authLoading, isError: authError } = useAuthUser();
  const isRealUser = Boolean(me?.id);
  const orgSnapQ = useOrgSnapshot({ enabled: enabled && isRealUser });
  const catalogQ = useDealerBaseRows();
  const dbScope = useMyScopeFromDB(enabled && isRealUser);

  const scope = useMemo(
    () =>
      buildSidebarNavRealScope({
        isRealUser,
        authLoading,
        authError,
        role: me?.role,
        snap: orgSnapQ.data,
        visPayload: dbScope.ready
          ? {
              all: dbScope.scope_explanation.full_catalog,
              codes: dbScope.scope_explanation.full_catalog
                ? null
                : Array.from(dbScope.activeDealerExternalKeySet),
              assignments: null,
            }
          : undefined,
        orgSnapError: orgSnapQ.isError,
        visCodesError: dbScope.error,
        orgSnapLoading: orgSnapQ.isLoading,
        visCodesLoading: dbScope.loading,
        assignmentsScope: undefined,
        catalogRows: catalogQ.data,
        dbScopedExternalKeys: dbScope.ready ? dbScope.activeDealerExternalKeySet : undefined,
      }),
    [
      isRealUser,
      authLoading,
      authError,
      me?.role,
      orgSnapQ.data,
      orgSnapQ.isError,
      orgSnapQ.isLoading,
      catalogQ.data,
      dbScope.ready,
      dbScope.loading,
      dbScope.error,
      dbScope.scope_explanation.full_catalog,
      dbScope.activeDealerExternalKeySet,
    ],
  );

  useEffect(() => {
    if (me?.role !== "regional_manager") return;
    console.debug("[rm-scope] useSidebarNavRealScope", {
      ready: scope.ready,
      loading: scope.loading,
      isRealUser: scope.isRealUser,
      access: scope.orgScope?.access,
      meTeamId: scope.orgScope?.snap.me.teamId,
      releaseDealerRows: scope.releaseDealerRows?.length ?? 0,
      dbScopeActive: dbScope.totals.active_dealers,
    });
  }, [me?.role, scope, dbScope.totals.active_dealers]);

  return scope;
}
