import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UserRole } from "@shared/auth";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import { useMyVisibleClientCodes } from "@/lib/use-my-visible-client-codes";
import { useMyClientCodes } from "@/hooks/use-my-client-codes";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import type { GlobalSearchResult } from "@shared/search-handlers";
import { searchGlobal } from "@/lib/search/global-search-api";
import { filterQuickLinks, type GlobalSearchQuickLink } from "@/lib/search/global-search-quick-links";
import {
  buildDefaultLocalSearchContext,
  buildLocalGlobalSearch,
  emptyGlobalSearchResult,
} from "@/lib/search/local-global-search";
import {
  dedupeById,
  GLOBAL_SEARCH_LIMIT_PER_TYPE,
  isContentSearchQuery,
} from "@/lib/search/search-query-utils";
import type { AssignmentDto } from "@/lib/showcase-assignments-api";
import { assignmentsScopeIsActive, type AssignmentsScope } from "@/lib/dealer-base-real-scope";

const SERVER_DEBOUNCE_MS = 280;

function mergeSearchResults(local: GlobalSearchResult, remote: GlobalSearchResult): GlobalSearchResult {
  const limit = GLOBAL_SEARCH_LIMIT_PER_TYPE;
  return {
    clients: dedupeById([...local.clients, ...remote.clients]).slice(0, limit),
    tradePoints: dedupeById([...local.tradePoints, ...remote.tradePoints]).slice(0, limit),
    products: dedupeById([...local.products, ...remote.products]).slice(0, limit),
    assignments: dedupeById([...local.assignments, ...remote.assignments]).slice(0, limit),
  };
}

function readAssignmentCache(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
): { incoming: AssignmentDto[]; outgoing: AssignmentDto[] } {
  const incoming =
    queryClient.getQueryData<AssignmentDto[]>(["tasks-inbox", "incoming"]) ?? [];
  const outgoingActive =
    queryClient.getQueryData<AssignmentDto[]>(["tasks-inbox", "outgoing", userId ?? "", "active"]) ?? [];
  const outgoingArchived =
    queryClient.getQueryData<AssignmentDto[]>(["tasks-inbox", "outgoing", userId ?? "", "archived"]) ?? [];
  return { incoming, outgoing: [...outgoingActive, ...outgoingArchived] };
}

export type UseGlobalSearchResult = {
  query: string;
  setQuery: (value: string) => void;
  quickLinks: GlobalSearchQuickLink[];
  results: GlobalSearchResult;
  isServerLoading: boolean;
  hasContentQuery: boolean;
  isEmpty: boolean;
};

export function useGlobalSearch(open: boolean, role: UserRole | null | undefined): UseGlobalSearchResult {
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuthUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const teamCtx = useClientBaseTeamActualization();
  const isRealUser = Boolean(user?.id);
  const orgSnapQ = useOrgSnapshot({ enabled: isRealUser });
  const visCodesQ = useMyVisibleClientCodes({ enabled: isRealUser });
  const myCodesQ = useMyClientCodes({ enabled: isRealUser });

  const assignmentsScope = useMemo((): AssignmentsScope | undefined => {
    if (!myCodesQ.data) return undefined;
    return { ownCodes: myCodesQ.data.ownCodes, teamCodes: myCodesQ.data.teamCodes };
  }, [myCodesQ.data]);

  const actState = actx.enabled ? teamCtx.mergedState : buildDefaultLocalSearchContext(profile).actState;

  const assignmentCache = useMemo(
    () => readAssignmentCache(queryClient, user?.id),
    [queryClient, user?.id, open, query],
  );

  const localContext = useMemo(() => {
    if (!open) return buildDefaultLocalSearchContext(profile);
    return {
      role: role ?? user?.role ?? null,
      profile,
      isRealUser,
      snap: orgSnapQ.data ?? null,
      visPayload: visCodesQ.data ?? null,
      assignmentsScope: assignmentsScopeIsActive(assignmentsScope) ? assignmentsScope : undefined,
      actState,
      actEnabled: actx.enabled,
      incomingAssignments: assignmentCache.incoming,
      outgoingAssignments: assignmentCache.outgoing,
    };
  }, [
    open,
    role,
    user?.role,
    profile,
    isRealUser,
    orgSnapQ.data,
    visCodesQ.data,
    assignmentsScope,
    actState,
    actx.enabled,
    assignmentCache,
  ]);

  const hasContentQuery = isContentSearchQuery(query);

  const localResults = useMemo(() => {
    if (!open || !hasContentQuery) return emptyGlobalSearchResult();
    return buildLocalGlobalSearch(localContext, query);
  }, [open, hasContentQuery, localContext, query]);

  const [serverResults, setServerResults] = useState<GlobalSearchResult>(emptyGlobalSearchResult());
  const [isServerLoading, setIsServerLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setServerResults(emptyGlobalSearchResult());
      setIsServerLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !hasContentQuery) {
      setServerResults(emptyGlobalSearchResult());
      setIsServerLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsServerLoading(true);

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const q = query;

      void searchGlobal(q, { signal: controller.signal, limitPerType: GLOBAL_SEARCH_LIMIT_PER_TYPE })
        .then((result) => {
          if (controller.signal.aborted) return;
          setServerResults(result);
          setIsServerLoading(false);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          if (e instanceof DOMException && e.name === "AbortError") return;
          setIsServerLoading(false);
        });
    }, SERVER_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, hasContentQuery, query]);

  const results = useMemo(() => {
    if (!hasContentQuery) return emptyGlobalSearchResult();
    return mergeSearchResults(localResults, serverResults);
  }, [hasContentQuery, localResults, serverResults]);

  const quickLinks = useMemo(
    () => filterQuickLinks(role ?? user?.role ?? null, query),
    [role, user?.role, query],
  );

  const isEmpty =
    hasContentQuery &&
    results.clients.length === 0 &&
    results.tradePoints.length === 0 &&
    results.products.length === 0 &&
    results.assignments.length === 0 &&
    !isServerLoading;

  return {
    query,
    setQuery,
    quickLinks,
    results,
    isServerLoading,
    hasContentQuery,
    isEmpty,
  };
}
