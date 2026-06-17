import type { QueryClient } from "@tanstack/react-query";
import type { AuthUserDTO } from "@/lib/auth-api";
import { AUTH_ME_QUERY_KEY } from "@/hooks/use-auth-user";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { MyVisibleCodesResult } from "@/lib/use-my-visible-client-codes";
import { seedFeatureFlagsFromBootstrap } from "@/lib/dealer-base-source";

export type BootstrapFeatureFlags = {
  success: true;
  flags: {
    USE_DB_DEALERS: boolean;
    SHADOW_DIFF_ENABLED: boolean;
  };
};

type VisibleClientsPayload =
  | { all: true; codes: null; assignments: null }
  | {
      all: false;
      codes: string[];
      assignments: Array<{ code: string; responsibleUserId: string | null; teamId: string | null }>;
    };

export type BootstrapPayload = {
  success: true;
  bootstrap_version: number;
  me: AuthUserDTO;
  org_snapshot: OrgSnapshot & { success: true };
  visible_codes: VisibleClientsPayload;
  feature_flags: BootstrapFeatureFlags;
  generated_at: string;
};

function visibleCodesToQueryResult(payload: VisibleClientsPayload): MyVisibleCodesResult {
  if (payload.all) return { all: true, codes: null, assignments: null };
  return {
    all: false,
    codes: payload.codes,
    assignments: payload.assignments ?? [],
  };
}

export async function fetchBootstrap(): Promise<BootstrapPayload | null> {
  try {
    const res = await fetch("/api/bootstrap", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BootstrapPayload;
    if (!data?.success) return null;
    return data;
  } catch {
    return null;
  }
}

export function prewarmFromBootstrap(qc: QueryClient, b: BootstrapPayload): void {
  qc.setQueryData([...AUTH_ME_QUERY_KEY], b.me);
  qc.setQueryData(["auth", "org-snapshot"], b.org_snapshot);
  qc.setQueryData(["auth", "my-visible-codes"], visibleCodesToQueryResult(b.visible_codes));
  seedFeatureFlagsFromBootstrap(b.feature_flags);
}
