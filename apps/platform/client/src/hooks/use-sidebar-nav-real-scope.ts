import { useEffect, useMemo } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useMyScopeFromDB } from "@/hooks/use-my-scope-from-db";
import { useMyTeamScope } from "@/hooks/use-my-team-scope";
import { useOrgScope } from "@/hooks/use-org-scope";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import { useDealerBaseRows } from "@/lib/dealer-base-source";
import { buildSidebarNavRealScope, type SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import { buildAssignmentsScopeFromSources } from "@/lib/dealer-base-real-scope";
import { useStableArrayByIds, useStableSet } from "@/lib/stable-refs";

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
  const teamScopeQ = useMyTeamScope({ enabled: enabled && isRealUser && me?.role === "rop" });
  const orgScopeQ = useOrgScope({ enabled: enabled && isRealUser && me?.role === "director" });

  const catalogStable = useStableArrayByIds(catalogQ.data ?? []);
  const dbExtKeysStable = useStableSet(
    dbScope.ready ? Array.from(dbScope.activeDealerExternalKeySet) : undefined,
  );
  const dbFullCatalog = dbScope.scope_explanation.full_catalog;

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
              all: dbFullCatalog,
              codes: dbFullCatalog ? null : Array.from(dbExtKeysStable),
              assignments: null,
            }
          : undefined,
        orgSnapError: orgSnapQ.isError,
        visCodesError: dbScope.error,
        orgSnapLoading: orgSnapQ.isLoading,
        visCodesLoading: dbScope.loading,
        assignmentsScope: dbScope.ready
          ? buildAssignmentsScopeFromSources({
              ownCodes: dbExtKeysStable,
            })
          : undefined,
        catalogRows: catalogStable,
        dbScopedExternalKeys: dbScope.ready ? dbExtKeysStable : undefined,
        dbFullCatalog: dbScope.ready ? dbFullCatalog : false,
        teamScope: teamScopeQ.data,
        orgScopeData: orgScopeQ.data,
      }),
    [
      isRealUser,
      authLoading,
      authError,
      me?.role,
      orgSnapQ.data,
      orgSnapQ.isError,
      orgSnapQ.isLoading,
      catalogStable,
      dbScope.ready,
      dbScope.loading,
      dbScope.error,
      dbFullCatalog,
      dbExtKeysStable,
      teamScopeQ.data,
      orgScopeQ.data,
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
