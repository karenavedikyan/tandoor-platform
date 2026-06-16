import { useEffect, useMemo } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useMyClientCodes } from "@/hooks/use-my-client-codes";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import { useMyVisibleClientCodes } from "@/lib/use-my-visible-client-codes";
import { buildSidebarNavRealScope, type SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";

export function useSidebarNavRealScope(enabled = true): SidebarNavRealScope {
  const { user: me, isLoading: authLoading, isError: authError } = useAuthUser();
  const isRealUser = Boolean(me?.id);
  const orgSnapQ = useOrgSnapshot({ enabled: enabled && isRealUser });
  const visCodesQ = useMyVisibleClientCodes({ enabled: enabled && isRealUser });
  const myCodesQ = useMyClientCodes({ enabled: enabled && isRealUser });

  const assignmentsScope = useMemo(() => {
    if (!myCodesQ.data) return undefined;
    return {
      ownCodes: myCodesQ.data.ownCodes,
      teamCodes: myCodesQ.data.teamCodes,
      grantedCodes: myCodesQ.data.grantedCodes,
    };
  }, [myCodesQ.data]);

  const scope = useMemo(
    () =>
      buildSidebarNavRealScope({
        isRealUser,
        authLoading,
        authError,
        role: me?.role,
        snap: orgSnapQ.data,
        visPayload: visCodesQ.data,
        orgSnapError: orgSnapQ.isError,
        visCodesError: visCodesQ.isError,
        orgSnapLoading: orgSnapQ.isLoading,
        visCodesLoading: visCodesQ.isLoading,
        assignmentsScope,
      }),
    [
      isRealUser,
      authLoading,
      authError,
      me?.role,
      orgSnapQ.data,
      visCodesQ.data,
      orgSnapQ.isError,
      visCodesQ.isError,
      orgSnapQ.isLoading,
      visCodesQ.isLoading,
      assignmentsScope,
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
    });
  }, [me?.role, scope]);

  return scope;
}
