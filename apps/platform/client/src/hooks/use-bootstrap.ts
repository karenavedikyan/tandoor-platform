/**
 * Bootstrap prefetch для authenticated shell (Промт 380).
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AUTH_ME_QUERY_KEY } from "@/hooks/use-auth-user";
import type { AuthUserDTO } from "@/lib/auth-api";
import type { MyClientCodesData } from "@/hooks/use-my-client-codes";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { MyVisibleCodesResult } from "@/lib/use-my-visible-client-codes";
import {
  setBootstrapActualizationPrefetch,
  type ActualizationApiMeta,
} from "@/lib/client-base-actualization-api";
import { setFeatureFlagsFromBootstrap } from "@/lib/dealer-base-source";

export const BOOTSTRAP_QUERY_KEY = ["bootstrap"] as const;

export type BootstrapData = {
  user: AuthUserDTO;
  feature_flags: { success: true; flags: Record<string, boolean> };
  my_client_codes: {
    success: true;
    ownCodes: string[];
    teamCodes: string[];
    grantedCodes: string[];
    responsibleByCode: Record<string, string>;
    meta: MyClientCodesData["meta"];
  };
  my_org_snapshot: OrgSnapshot & { success: true };
  my_visible_codes: MyVisibleCodesResult & { success: true };
  actualization_state: ActualizationApiMeta;
  server_time: string;
  etag: string;
  errors?: string[];
};

async function fetchBootstrap(): Promise<BootstrapData> {
  const res = await fetch("/api/bootstrap", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401) {
    throw new Error("UNAUTHENTICATED");
  }
  if (!res.ok) {
    throw new Error(`bootstrap_${res.status}`);
  }
  return (await res.json()) as BootstrapData;
}

function seedQueryCaches(qc: ReturnType<typeof useQueryClient>, data: BootstrapData): void {
  if (data.user) {
    qc.setQueryData([...AUTH_ME_QUERY_KEY], data.user);
  }

  if (data.my_client_codes?.success) {
    const c = data.my_client_codes;
    qc.setQueryData<MyClientCodesData | null>(["my-client-codes"], {
      ownCodes: new Set(c.ownCodes),
      teamCodes: new Set(c.teamCodes),
      grantedCodes: new Set(c.grantedCodes ?? []),
      responsibleByCode: c.responsibleByCode ?? {},
      meta: c.meta,
    });
  }

  if (data.my_org_snapshot?.success) {
    const { success: _s, ...snap } = data.my_org_snapshot;
    qc.setQueryData<OrgSnapshot | null>(["auth", "org-snapshot"], snap);
  }

  if (data.my_visible_codes?.success) {
    const v = data.my_visible_codes;
    qc.setQueryData<MyVisibleCodesResult>(["auth", "my-visible-codes"], {
      all: v.all,
      codes: v.codes,
      assignments: v.assignments,
    });
  }

  if (data.feature_flags?.flags) {
    setFeatureFlagsFromBootstrap(data.feature_flags.flags);
  }

  if (data.actualization_state) {
    setBootstrapActualizationPrefetch(data.actualization_state);
  }
}

export function useBootstrap(options?: { enabled?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [...BOOTSTRAP_QUERY_KEY],
    queryFn: fetchBootstrap,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });

  useEffect(() => {
    if (q.data) seedQueryCaches(qc, q.data);
  }, [q.data, qc]);

  return q;
}
