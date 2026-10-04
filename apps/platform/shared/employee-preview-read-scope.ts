/**
 * Unified read contract for active employee preview sessions.
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type { WholesaleEmployeePreviewScope } from "./wholesale-org-types.js";
import {
  buildEmployeePreviewState,
  type EmployeePreviewSession,
} from "./wholesale-preview-handlers.js";

export type EmployeePreviewReadScope =
  | { mode: "off" }
  | {
      mode: "active";
      session: EmployeePreviewSession;
      /** false when scope build failed, unconfirmed, or roster/assignment invalid */
      readable: false;
      error: { code: string; message: string };
      scope: null;
    }
  | {
      mode: "active";
      session: EmployeePreviewSession;
      readable: true;
      confirmed: boolean;
      scope: WholesaleEmployeePreviewScope;
      error: null;
    };

export async function resolveEmployeePreviewReadScope(
  pool: PoolLike,
  refreshTokenHash: string | null | undefined,
): Promise<EmployeePreviewReadScope> {
  if (!refreshTokenHash) return { mode: "off" };

  const state = await buildEmployeePreviewState(pool, refreshTokenHash);
  if (!state.active || !state.preview) return { mode: "off" };

  if (state.error) {
    return {
      mode: "active",
      session: state.preview,
      readable: false,
      error: state.error,
      scope: null,
    };
  }
  if (!state.scope) {
    return {
      mode: "active",
      session: state.preview,
      readable: false,
      error: { code: "SCOPE_UNAVAILABLE", message: "Не удалось построить область предпросмотра." },
      scope: null,
    };
  }
  if (!state.scope.confirmed) {
    return {
      mode: "active",
      session: state.preview,
      readable: false,
      error: {
        code: state.scope.reason ?? "UNCONFIRMED_SCOPE",
        message: `Область не подтверждена: ${state.scope.reason ?? "UNKNOWN"}.`,
      },
      scope: null,
    };
  }

  return {
    mode: "active",
    session: state.preview,
    readable: true,
    confirmed: true,
    scope: state.scope,
    error: null,
  };
}

export function previewAllowedClientKeys(read: EmployeePreviewReadScope): Set<string> | null {
  if (read.mode !== "active" || !read.readable || !read.scope) return null;
  return new Set(read.scope.activeDealerExternalKeys);
}

export function previewAllowedStoreGuids(read: EmployeePreviewReadScope): Set<string> | null {
  if (read.mode !== "active" || !read.readable || !read.scope) return null;
  return new Set(read.scope.activeStoreGuids);
}

export function previewForcesEmptyScope(read: EmployeePreviewReadScope): boolean {
  return read.mode === "active" && !read.readable;
}
