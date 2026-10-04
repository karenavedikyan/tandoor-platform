/**
 * Effective read scope for /1c/* endpoints — preview + wholesale viewer access.
 */

import type { OneCRopNode } from "./one-c-showroom-context.js";
import type { PoolLike } from "./responsibility-resolver.js";
import type { OneCViewer } from "./one-c-showroom-scope.js";
import type { WholesaleClientAssignment } from "./wholesale-org-types.js";
import {
  resolveEmployeePreviewReadScope,
  type EmployeePreviewReadScope,
} from "./employee-preview-read-scope.js";
import { readWholesaleOrg, hasWholesaleOrgData } from "./wholesale-org-read.js";
import type { WholesaleOrgReadResult } from "./wholesale-org-types.js";
import {
  buildWholesaleViewerScope,
  clientInViewerScope,
  type WholesaleViewerScope,
} from "./wholesale-viewer-scope.js";
import { resolveConfirmedEmployeeGuid } from "./wholesale-showroom-scope.js";

export type OneCReadContext = {
  viewer: OneCViewer;
  previewRead: EmployeePreviewReadScope;
  /** Active employee preview session (read-only). */
  previewActive: boolean;
  /** Data reads restricted to preview scope (admin preview). */
  previewRestricts: boolean;
  allowedExternalKeys: Set<string> | null;
  allowedStoreGuids: Set<string> | null;
  allowedClientGuids: Set<string> | null;
};

export async function resolveOneCReadContext(
  pool: PoolLike,
  viewer: OneCViewer,
  refreshTokenHash: string | null | undefined,
): Promise<OneCReadContext> {
  const previewRead = await resolveEmployeePreviewReadScope(pool, refreshTokenHash);
  const previewActive = previewRead.mode === "active";
  let previewRestricts = false;
  let allowedExternalKeys: Set<string> | null = null;
  let allowedStoreGuids: Set<string> | null = null;
  let allowedClientGuids: Set<string> | null = null;

  if (previewRead.mode === "active") {
    previewRestricts = true;
    if (previewRead.readable && previewRead.scope) {
      allowedExternalKeys = new Set(previewRead.scope.activeDealerExternalKeys);
      allowedStoreGuids = new Set(previewRead.scope.activeStoreGuids);
      if (await hasWholesaleOrgData(pool)) {
        const org = await readWholesaleOrg(pool);
        allowedClientGuids = clientGuidsForExternalKeys(org, allowedExternalKeys);
      } else {
        allowedClientGuids = new Set();
      }
    } else {
      allowedExternalKeys = new Set();
      allowedStoreGuids = new Set();
      allowedClientGuids = new Set();
    }
  }

  return {
    viewer,
    previewRead,
    previewActive,
    previewRestricts,
    allowedExternalKeys,
    allowedStoreGuids,
    allowedClientGuids,
  };
}

function clientGuidsForExternalKeys(org: WholesaleOrgReadResult, keys: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const c of org.clients) {
    if (keys.has(c.externalKey)) out.add(c.guidClient);
  }
  return out;
}

export function previewBlocksAllOneCData(ctx: OneCReadContext): boolean {
  return ctx.previewRestricts && (ctx.allowedStoreGuids?.size ?? 0) === 0 && (ctx.allowedClientGuids?.size ?? 0) === 0;
}

export function storeAllowedInReadContext(ctx: OneCReadContext, storeGuid: string, clientGuid?: string | null): boolean {
  if (!ctx.previewRestricts) return true;
  if (ctx.allowedStoreGuids?.has(storeGuid)) return true;
  if (clientGuid && ctx.allowedClientGuids?.has(clientGuid)) {
    return ctx.allowedStoreGuids?.size === 0;
  }
  return false;
}

export function clientAllowedInReadContext(ctx: OneCReadContext, clientGuid: string, externalKey?: string | null): boolean {
  if (!ctx.previewRestricts) return true;
  if (ctx.allowedClientGuids?.has(clientGuid)) return true;
  if (externalKey && ctx.allowedExternalKeys?.has(externalKey)) return true;
  return false;
}

export async function resolveWholesaleViewerScopeForOneC(
  pool: PoolLike,
  viewer: OneCViewer,
  ropContextGuid?: string | null,
): Promise<{ org: WholesaleOrgReadResult; scope: WholesaleViewerScope; confirmed: string | null }> {
  const org = await readWholesaleOrg(pool);
  const confirmed =
    viewer.role === "admin" || viewer.role === "director"
      ? null
      : await resolveConfirmedEmployeeGuid(pool, viewer.id);
  const scope = buildWholesaleViewerScope(org, viewer, confirmed, ropContextGuid);
  return { org, scope, confirmed };
}

export async function canAccessWholesaleStore(
  pool: PoolLike,
  storeGuid: string,
  ctx: OneCReadContext,
  ropContextGuid?: string | null,
): Promise<boolean> {
  if (!(await hasWholesaleOrgData(pool))) return false;
  const { org, scope } = await resolveWholesaleViewerScopeForOneC(pool, ctx.viewer, ropContextGuid);
  const outlet = org.outlets.find((o) => o.guidStore === storeGuid);
  if (!outlet) return false;
  const client = org.clients.find((c) => c.guidClient === outlet.guidClient);
  if (!client) return false;

  if (ctx.previewRestricts) {
    return storeAllowedInReadContext(ctx, storeGuid, client.guidClient);
  }

  if (!clientInViewerScope(client, scope)) return false;
  return true;
}

export async function canAccessWholesaleClient(
  pool: PoolLike,
  clientGuid: string,
  ctx: OneCReadContext,
  ropContextGuid?: string | null,
): Promise<boolean> {
  if (!(await hasWholesaleOrgData(pool))) return false;
  const { org, scope } = await resolveWholesaleViewerScopeForOneC(pool, ctx.viewer, ropContextGuid);
  const client = org.clients.find((c) => c.guidClient === clientGuid);
  if (!client) return false;

  if (ctx.previewRestricts) {
    return clientAllowedInReadContext(ctx, clientGuid, client.externalKey);
  }

  return clientInViewerScope(client, scope);
}

export function filterClientsForReadContext(
  clients: WholesaleClientAssignment[],
  ctx: OneCReadContext,
): WholesaleClientAssignment[] {
  if (!ctx.previewRestricts) return clients;
  const allowed = ctx.allowedClientGuids ?? new Set<string>();
  return clients.filter((c) => allowed.has(c.guidClient));
}

export function filterWholesaleHierarchyForPreview(
  items: OneCRopNode[],
  org: WholesaleOrgReadResult,
  ctx: OneCReadContext,
): OneCRopNode[] {
  if (!ctx.previewRestricts) return items;
  const allowedClients = ctx.allowedClientGuids ?? new Set<string>();
  if (allowedClients.size === 0) return [];

  return items
    .map((node) => {
      const ropClients = org.clients.filter(
        (c) => (c.headOfSalesGuid ?? "__no_rop__") === node.userId && allowedClients.has(c.guidClient),
      );
      if (ropClients.length === 0) return null;

      const allowedMgr = new Set(
        ropClients.map((c) => c.responsibleManagerGuid).filter(Boolean) as string[],
      );
      const allowedRm = new Set(
        ropClients.map((c) => c.regionalManagerGuid).filter(Boolean) as string[],
      );

      const managers = node.managers
        .filter((m) => allowedMgr.has(m.userId))
        .map((m) => {
          const mc = ropClients.filter((c) => c.responsibleManagerGuid === m.userId);
          const stores = new Set(mc.flatMap((c) => c.openStoreGuids));
          return { ...m, legalCount: mc.length, storeCount: stores.size };
        });
      const rms = node.rms
        .filter((rm) => allowedRm.has(rm.userId))
        .map((rm) => {
          const rc = ropClients.filter((c) => c.regionalManagerGuid === rm.userId);
          const stores = new Set(rc.flatMap((c) => c.openStoreGuids));
          return { ...rm, legalCount: rc.length, storeCount: stores.size };
        });
      const storeSet = new Set(ropClients.flatMap((c) => c.openStoreGuids));
      return {
        ...node,
        managers,
        rms,
        managerCount: managers.length,
        rmCount: rms.length,
        legalCount: ropClients.length,
        storeCount: storeSet.size,
      };
    })
    .filter(Boolean) as OneCRopNode[];
}
