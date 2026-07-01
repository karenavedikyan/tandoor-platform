import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UserRole } from "@shared/auth";
import { useAuthUser } from "../../hooks/use-auth-user.js";
import { useMyTeamScope } from "../../hooks/use-my-team-scope.js";
import { useOrgScope } from "../../hooks/use-org-scope.js";
import { useReleaseDemoProfile } from "../../hooks/use-release-demo-profile.js";
import { useOrgSnapshot } from "../use-org-snapshot.js";
import { useMyVisibleClientCodes } from "../use-my-visible-client-codes.js";
import { useMyClientCodes } from "../../hooks/use-my-client-codes.js";
import { useClientBaseActualization } from "../../context/client-base-actualization-context.js";
import { useClientBaseTeamActualization } from "../../context/client-base-team-actualization-context.js";
import type { GlobalSearchResult } from "@shared/search-handlers";
import { searchGlobal } from "../search/global-search-api.js";
import { filterQuickLinks, type GlobalSearchQuickLink } from "../search/global-search-quick-links.js";
import {
  buildDefaultLocalSearchContext,
  buildScopedDealerRowsForSearch,
  emptyGlobalSearchResult,
  matchLocalGlobalSearch,
} from "../search/local-global-search.js";
import {
  dedupeById,
  GLOBAL_SEARCH_LIMIT_PER_TYPE,
  isContentSearchQuery,
} from "../search/search-query-utils.js";
import type { AssignmentDto } from "../showcase-assignments-api.js";
import { assignmentsScopeIsActive, type AssignmentsScope } from "../dealer-base-real-scope.js";

const SERVER_DEBOUNCE_MS = 280;
const LOCAL_DEBOUNCE_MS = 180;

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
  const effectiveRole = role ?? user?.role ?? null;
  const orgSnapQ = useOrgSnapshot({ enabled: isRealUser });
  const visCodesQ = useMyVisibleClientCodes({ enabled: isRealUser });
  const myCodesQ = useMyClientCodes({ enabled: isRealUser });
  const teamScopeQ = useMyTeamScope({ enabled: isRealUser && effectiveRole === "rop" });
  const orgScopeQ = useOrgScope({ enabled: isRealUser && effectiveRole === "director" });

  const assignmentsScope = useMemo((): AssignmentsScope | undefined => {
    if (!myCodesQ.data) return undefined;
    return {
      ownCodes: myCodesQ.data.ownCodes,
      teamCodes: myCodesQ.data.teamCodes,
      grantedCodes: myCodesQ.data.grantedCodes,
    };
  }, [myCodesQ.data]);

  const actState = actx.enabled ? teamCtx.mergedState : buildDefaultLocalSearchContext(profile).actState;

  const assignmentCache = useMemo(
    () => readAssignmentCache(queryClient, user?.id),
    [queryClient, user?.id, open, query],
  );

  const localContext = useMemo(() => {
    if (!open) return buildDefaultLocalSearchContext(profile);
    return {
      role: effectiveRole,
      profile,
      isRealUser,
      snap: orgSnapQ.data ?? null,
      visPayload: visCodesQ.data ?? null,
      teamScope: teamScopeQ.data ?? null,
      orgScope: orgScopeQ.data ?? null,
      assignmentsScope: assignmentsScopeIsActive(assignmentsScope) ? assignmentsScope : undefined,
      actState,
      actEnabled: actx.enabled,
      incomingAssignments: assignmentCache.incoming,
      outgoingAssignments: assignmentCache.outgoing,
    };
  }, [
    open,
    effectiveRole,
    profile,
    isRealUser,
    orgSnapQ.data,
    visCodesQ.data,
    teamScopeQ.data,
    orgScopeQ.data,
    assignmentsScope,
    actState,
    actx.enabled,
    assignmentCache,
  ]);

  const hasContentQuery = isContentSearchQuery(query);

  const scopedRows = useMemo(
    () => (open ? buildScopedDealerRowsForSearch(localContext) : []),
    [open, localContext],
  );

  const [debouncedQuery, setDebouncedQuery] = useState("");
  const localDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setDebouncedQuery("");
      if (localDebounceRef.current) clearTimeout(localDebounceRef.current);
      localDebounceRef.current = null;
      return;
    }
    if (!hasContentQuery) {
      setDebouncedQuery("");
      if (localDebounceRef.current) clearTimeout(localDebounceRef.current);
      localDebounceRef.current = null;
      return;
    }
    if (localDebounceRef.current) clearTimeout(localDebounceRef.current);
    localDebounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, LOCAL_DEBOUNCE_MS);
    return () => {
      if (localDebounceRef.current) clearTimeout(localDebounceRef.current);
    };
  }, [open, hasContentQuery, query]);

  const hasDebouncedContentQuery = isContentSearchQuery(debouncedQuery);

  const localResults = useMemo(() => {
    if (!open || !hasDebouncedContentQuery) return emptyGlobalSearchResult();
    return matchLocalGlobalSearch(localContext, scopedRows, debouncedQuery);
  }, [open, hasDebouncedContentQuery, localContext, scopedRows, debouncedQuery]);

  const [serverResults, setServerResults] = useState<GlobalSearchResult>(emptyGlobalSearchResult());
  const [isServerLoading, setIsServerLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setServerResults(emptyGlobalSearchResult());
      setIsServerLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (localDebounceRef.current) clearTimeout(localDebounceRef.current);
      localDebounceRef.current = null;
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
