/**
 * Объединение ActualizationState нескольких пользователей для дашборда активности (РОП / директор).
 * Конфликты по одному id: остаётся запись с более поздним updatedAt / createdAt / archivedAt.
 */

import type { ActualizationEntityPhoto } from "@/lib/client-base-actualization-state";
import {
  createEmptyActualizationState,
  mergeActualizationState,
  type ActualizationState,
  type ArchivedDealerContactInfo,
  type ArchivedDealerInfo,
  type ArchivedLegalEntityInfo,
  type ArchivedTradePointInfo,
  type DealerActualizationAudit,
  type DealerActualizationContact,
  type DealerActualizationOverride,
  type LegalEntityActualizationState,
  type ManualDealer,
  type ManualTradePoint,
  type TradePointActualizationOverride,
  type TradePointShowcaseActualization,
  type TrashedDealerInfo,
  type TrashedTradePointInfo,
} from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  getTeamLeadForTeam,
  getTeamManagers,
  SALES_USERS,
  getSalesUserById,
} from "@/lib/sales-control-data";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import { isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";

function isoMs(iso: string | null | undefined): number {
  if (!iso || typeof iso !== "string") return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

function maxMs(a: string | null | undefined, b: string | null | undefined): number {
  return Math.max(isoMs(a), isoMs(b));
}

function manualDealerRecency(m: ManualDealer): number {
  return maxMs(m.updatedAt, m.createdAt);
}

function manualTpRecency(m: ManualTradePoint): number {
  return maxMs(m.updatedAt, m.createdAt);
}

/** Какие userId загружать с /api/actualization/state для дашборда активности. */
export function resolveActualizationDashboardSourceUserIds(
  profile: ReleaseDemoProfile,
  dashboardRopTeamId: string,
): string[] {
  const self = profile.personaUserId.trim();
  if (!self) return [];

  if (profile.role === "sales_manager") {
    return [self];
  }

  if (profile.role === "team_lead") {
    const u = getSalesUserById(self);
    const teamId = u?.teamId ?? getEffectiveTeamLeadTeamId(profile);
    const ids = new Set<string>([self, ...getTeamManagers(teamId).map((m) => m.id)]);
    return Array.from(ids);
  }

  if (profile.role === "sales_director") {
    if (isRopOrManagerAllFilter(dashboardRopTeamId)) {
      const ids = new Set<string>();
      for (const x of SALES_USERS) {
        if (x.role === "sales_manager" || x.role === "team_lead") ids.add(x.id);
      }
      ids.add(self);
      return Array.from(ids);
    }
    const teamId = dashboardRopTeamId;
    const tl = getTeamLeadForTeam(teamId);
    const ids = new Set<string>([...getTeamManagers(teamId).map((m) => m.id), ...(tl ? [tl.id] : [])]);
    return Array.from(ids);
  }

  return [self];
}

function pickNewerManualDealer(a: ManualDealer, b: ManualDealer): ManualDealer {
  return manualDealerRecency(a) >= manualDealerRecency(b) ? a : b;
}

function pickNewerManualTp(a: ManualTradePoint, b: ManualTradePoint): ManualTradePoint {
  return manualTpRecency(a) >= manualTpRecency(b) ? a : b;
}

function pickNewerDealerOv(a: DealerActualizationOverride, b: DealerActualizationOverride): DealerActualizationOverride {
  return isoMs(a.updatedAt) >= isoMs(b.updatedAt) ? a : b;
}

function pickNewerTpOv(a: TradePointActualizationOverride, b: TradePointActualizationOverride): TradePointActualizationOverride {
  return isoMs(a.updatedAt) >= isoMs(b.updatedAt) ? a : b;
}

function pickNewerArchiveDealer(a: ArchivedDealerInfo, b: ArchivedDealerInfo): ArchivedDealerInfo {
  return isoMs(a.archivedAt) >= isoMs(b.archivedAt) ? a : b;
}

function pickNewerArchiveTp(a: ArchivedTradePointInfo, b: ArchivedTradePointInfo): ArchivedTradePointInfo {
  return isoMs(a.archivedAt) >= isoMs(b.archivedAt) ? a : b;
}

function pickNewerTrashedDealer(a: TrashedDealerInfo, b: TrashedDealerInfo): TrashedDealerInfo {
  return isoMs(a.trashedAt) >= isoMs(b.trashedAt) ? a : b;
}

function pickNewerTrashedTp(a: TrashedTradePointInfo, b: TrashedTradePointInfo): TrashedTradePointInfo {
  return isoMs(a.trashedAt) >= isoMs(b.trashedAt) ? a : b;
}

function pickNewerArchiveLegal(a: ArchivedLegalEntityInfo, b: ArchivedLegalEntityInfo): ArchivedLegalEntityInfo {
  return isoMs(a.archivedAt) >= isoMs(b.archivedAt) ? a : b;
}

function pickNewerArchiveContact(a: ArchivedDealerContactInfo, b: ArchivedDealerContactInfo): ArchivedDealerContactInfo {
  return isoMs(a.archivedAt) >= isoMs(b.archivedAt) ? a : b;
}

function pickNewerShowcase(a: TradePointShowcaseActualization, b: TradePointShowcaseActualization): TradePointShowcaseActualization {
  return isoMs(a.updatedAt) >= isoMs(b.updatedAt) ? a : b;
}

function pickNewerContact(a: DealerActualizationContact, b: DealerActualizationContact): DealerActualizationContact {
  return maxMs(a.updatedAt, a.createdAt) >= maxMs(b.updatedAt, b.createdAt) ? a : b;
}

function pickNewerAudit(a: DealerActualizationAudit, b: DealerActualizationAudit): DealerActualizationAudit {
  return isoMs(a.lastUpdatedAt) >= isoMs(b.lastUpdatedAt) ? a : b;
}

function mergeRecMap<T>(acc: Record<string, T>, incoming: Record<string, T>, pick: (a: T, b: T) => T): Record<string, T> {
  const r = { ...acc };
  for (const [id, v] of Object.entries(incoming)) {
    if (r[id] == null) r[id] = v;
    else r[id] = pick(r[id]!, v);
  }
  return r;
}

function mergeLegalEntityState(a: LegalEntityActualizationState, b: LegalEntityActualizationState): LegalEntityActualizationState {
  const oa = a.overridesById ?? {};
  const ob = b.overridesById ?? {};
  const keys = Array.from(new Set([...Object.keys(oa), ...Object.keys(ob)]));
  const mergedOverrides: Record<string, unknown> = {};
  for (const k of keys) {
    const ra = oa[k];
    const rb = ob[k];
    if (!ra || typeof ra !== "object" || Array.isArray(ra)) {
      if (rb && typeof rb === "object" && !Array.isArray(rb)) mergedOverrides[k] = rb;
      continue;
    }
    if (!rb || typeof rb !== "object" || Array.isArray(rb)) {
      mergedOverrides[k] = ra;
      continue;
    }
    const xa = ra as Record<string, unknown>;
    const xb = rb as Record<string, unknown>;
    const ta = maxMs(xa.updatedAt as string, xa.createdAt as string);
    const tb = maxMs(xb.updatedAt as string, xb.createdAt as string);
    mergedOverrides[k] = tb >= ta ? xb : xa;
  }
  return {
    createdById: [b.createdById, a.createdById].find((x) => typeof x === "string" && x.trim() !== "") ?? "",
    overridesById: mergedOverrides,
    archivedById: { ...(a.archivedById ?? {}), ...(b.archivedById ?? {}) },
    primaryLegalEntityId: a.primaryLegalEntityId ?? b.primaryLegalEntityId,
  };
}

function mergeLegalEntityMap(
  acc: Record<string, LegalEntityActualizationState>,
  next: Record<string, LegalEntityActualizationState>,
): Record<string, LegalEntityActualizationState> {
  const out = { ...acc };
  for (const [dealerId, st] of Object.entries(next)) {
    if (!out[dealerId]) {
      out[dealerId] = st;
      continue;
    }
    out[dealerId] = mergeLegalEntityState(out[dealerId]!, st);
  }
  return out;
}

function mergePhotoLists(a: ActualizationEntityPhoto[] | undefined, b: ActualizationEntityPhoto[] | undefined): ActualizationEntityPhoto[] {
  const map = new Map<string, ActualizationEntityPhoto>();
  for (const p of [...(a ?? []), ...(b ?? [])]) {
    const cur = map.get(p.id);
    if (!cur) {
      map.set(p.id, p);
      continue;
    }
    map.set(p.id, isoMs(p.uploadedAt) >= isoMs(cur.uploadedAt) ? p : cur);
  }
  return Array.from(map.values()).sort((x, y) => isoMs(y.uploadedAt) - isoMs(x.uploadedAt));
}

function mergePhotoMap(
  acc: Record<string, ActualizationEntityPhoto[]>,
  next: Record<string, ActualizationEntityPhoto[]>,
): Record<string, ActualizationEntityPhoto[]> {
  const out: Record<string, ActualizationEntityPhoto[]> = { ...acc };
  for (const [k, list] of Object.entries(next)) {
    out[k] = mergePhotoLists(out[k], list);
  }
  return out;
}

/**
 * Объединяет состояния нескольких менеджеров в один снимок для метрик/дашборда.
 * Порядок в `sources` не важен — выбирается более свежая запись по полям времени.
 */
export function mergeActualizationStatesForActivityDashboard(sources: { userId: string; state: ActualizationState }[]): ActualizationState {
  if (sources.length === 0) return createEmptyActualizationState();
  if (sources.length === 1) return mergeActualizationState(createEmptyActualizationState(), sources[0]!.state);

  let out = createEmptyActualizationState();
  let topUpdated = Number.NEGATIVE_INFINITY;
  let topUpdatedIso: string | null = null;

  for (const { state } of sources) {
    const tu = isoMs(state.updatedAt);
    if (tu > topUpdated) {
      topUpdated = tu;
      topUpdatedIso = typeof state.updatedAt === "string" ? state.updatedAt : null;
    }

    out = {
      ...out,
      dealerOverridesById: mergeRecMap(out.dealerOverridesById, state.dealerOverridesById, pickNewerDealerOv),
      manuallyCreatedDealersById: mergeRecMap(out.manuallyCreatedDealersById, state.manuallyCreatedDealersById, pickNewerManualDealer),
      archivedDealersById: mergeRecMap(out.archivedDealersById, state.archivedDealersById, pickNewerArchiveDealer),
      tradePointOverridesById: mergeRecMap(out.tradePointOverridesById, state.tradePointOverridesById, pickNewerTpOv),
      manuallyCreatedTradePointsById: mergeRecMap(out.manuallyCreatedTradePointsById, state.manuallyCreatedTradePointsById, pickNewerManualTp),
      archivedTradePointsById: mergeRecMap(out.archivedTradePointsById, state.archivedTradePointsById, pickNewerArchiveTp),
      archivedLegalEntitiesById: mergeRecMap(out.archivedLegalEntitiesById, state.archivedLegalEntitiesById, pickNewerArchiveLegal),
      archivedDealerContactsById: mergeRecMap(out.archivedDealerContactsById, state.archivedDealerContactsById, pickNewerArchiveContact),
      legalEntityOverridesByDealerId: mergeLegalEntityMap(out.legalEntityOverridesByDealerId, state.legalEntityOverridesByDealerId),
      tradePointShowcaseActualizationById: mergeRecMap(
        out.tradePointShowcaseActualizationById,
        state.tradePointShowcaseActualizationById,
        pickNewerShowcase,
      ),
      dealerActualizationContactsById: mergeRecMap(out.dealerActualizationContactsById, state.dealerActualizationContactsById, pickNewerContact),
      dealerActualizationAuditByDealerId: mergeRecMap(out.dealerActualizationAuditByDealerId, state.dealerActualizationAuditByDealerId, pickNewerAudit),
      dealerPhotosByDealerId: mergePhotoMap(out.dealerPhotosByDealerId, state.dealerPhotosByDealerId),
      tradePointPhotosByTradePointId: mergePhotoMap(out.tradePointPhotosByTradePointId, state.tradePointPhotosByTradePointId),
      dealerCardViewSettingsByUserId: { ...out.dealerCardViewSettingsByUserId, ...state.dealerCardViewSettingsByUserId },
      unloadingOrderByDealerId: { ...out.unloadingOrderByDealerId, ...state.unloadingOrderByDealerId },
      routeOrderByRouteId: { ...out.routeOrderByRouteId, ...state.routeOrderByRouteId },
      trashedDealersById: mergeRecMap(out.trashedDealersById, state.trashedDealersById ?? {}, pickNewerTrashedDealer),
      trashedTradePointsById: mergeRecMap(out.trashedTradePointsById, state.trashedTradePointsById ?? {}, pickNewerTrashedTp),
    };
  }

  out.updatedAt = topUpdatedIso;
  out.updatedBy = "team-merge";
  return out;
}

export function countManualDealersInState(state: ActualizationState): number {
  return Object.keys(state.manuallyCreatedDealersById ?? {}).length;
}

export function countManualTradePointsInState(state: ActualizationState): number {
  return Object.keys(state.manuallyCreatedTradePointsById ?? {}).length;
}
