/**
 * Team context для RBAC корзины/архива (Промт 398).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import { teamContextFromOrgSnapshot } from "@/lib/dealer-trash-scope";
import { EMPTY_TEAM_CONTEXT, type TeamContext } from "@shared/trash-archive-rbac";
import { fetchTeamContext, TEAM_CONTEXT_QUERY_KEY } from "@/lib/team-context-api";

export function useTeamContext(enabled = true): {
  teamContext: TeamContext;
  loading: boolean;
} {
  const { user } = useAuthUser();
  const realScope = useSidebarNavRealScope(enabled && Boolean(user?.id));

  const q = useQuery({
    queryKey: [...TEAM_CONTEXT_QUERY_KEY, user?.id ?? ""],
    queryFn: fetchTeamContext,
    enabled: enabled && Boolean(user?.id),
    staleTime: 60_000,
    retry: 1,
  });

  const fallback = teamContextFromOrgSnapshot(
    realScope.orgScope?.snap,
    realScope.assignmentsScope,
  );

  if (q.data?.success) {
    return {
      teamContext: {
        teamId: q.data.teamId,
        teamMemberIds: q.data.teamMemberIds,
        teamCodes: q.data.teamCodes,
      },
      loading: q.isLoading,
    };
  }

  if (realScope.ready && realScope.orgScope) {
    return { teamContext: fallback, loading: q.isLoading };
  }

  return { teamContext: EMPTY_TEAM_CONTEXT, loading: q.isLoading };
}
