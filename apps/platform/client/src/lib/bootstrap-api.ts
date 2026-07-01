import type { QueryClient } from "@tanstack/react-query";
import type { AuthUserDTO } from "./auth-api.js";
import { AUTH_ME_QUERY_KEY } from "../hooks/use-auth-user.js";
import type { OrgSnapshot } from "./use-org-snapshot.js";
import type { MyVisibleCodesResult } from "./use-my-visible-client-codes.js";
import { seedFeatureFlagsFromBootstrap } from "./dealer-base-source.js";
import { seedDistributionDbPrimaryFromBootstrap } from "./distribution-db-primary-flag.js";
import {
  isCatalogLazyLoadEnabled,
  seedCatalogLazyLoadFromBootstrap,
} from "./catalog-lazy-load-flag.js";
import { ensureCatalogLoaded } from "./catalog-data.js";
import { seedServerKpiAggregatesFromBootstrap } from "./server-kpi-aggregates-flag.js";
import { seedTpHydrationNoWritebackFromBootstrap } from "./tp-hydration-no-writeback-flag.js";
import { queryClient } from "./queryClient.js";

export type BootstrapFeatureFlags = {
  success: true;
  flags: {
    USE_DB_DEALERS: boolean;
    SHADOW_DIFF_ENABLED: boolean;
    USE_SERVER_KPI_AGGREGATES: boolean;
    TP_HYDRATION_NO_WRITEBACK: boolean;
    DISTRIBUTION_DB_PRIMARY_CAPACITY: boolean;
    CATALOG_LAZY_LOAD: boolean;
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

let bootstrapFlagsPromise: Promise<BootstrapFeatureFlags | null> | null = null;

/** Единый preload bootstrap; сидит флаги до первого fetchDealerBaseRows. */
export function ensureBootstrapPrewarm(qc: QueryClient = queryClient): Promise<BootstrapFeatureFlags | null> {
  if (!bootstrapFlagsPromise) {
    bootstrapFlagsPromise = fetchBootstrap().then((b) => {
      if (b) prewarmFromBootstrap(qc, b);
      return b?.feature_flags ?? null;
    });
  }
  return bootstrapFlagsPromise;
}

export function prewarmFromBootstrap(qc: QueryClient, b: BootstrapPayload): void {
  qc.setQueryData([...AUTH_ME_QUERY_KEY], b.me);
  qc.setQueryData(["auth", "org-snapshot"], b.org_snapshot);
  qc.setQueryData(["auth", "my-visible-codes"], visibleCodesToQueryResult(b.visible_codes));
  seedFeatureFlagsFromBootstrap(b.feature_flags);
  seedServerKpiAggregatesFromBootstrap(b.feature_flags);
  seedTpHydrationNoWritebackFromBootstrap(b.feature_flags);
  seedDistributionDbPrimaryFromBootstrap(b.feature_flags);
  seedCatalogLazyLoadFromBootstrap(b.feature_flags);
  if (!isCatalogLazyLoadEnabled()) {
    void ensureCatalogLoaded();
  }
}
