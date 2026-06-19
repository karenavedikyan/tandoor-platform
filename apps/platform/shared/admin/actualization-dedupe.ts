import { RELEASE_CLIENT_ROWS } from "../../client/src/lib/release-client-seed.generated.js";
import type {
  ActualizationState,
  DealerActualizationOverride,
  ManualDealer,
  ManualTradePoint,
} from "../../client/src/lib/client-base-actualization-state.js";

export const MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE: Record<string, string> = {
  "mgr-boyko-em": "dc3b6ef1-fd83-4b9b-b73f-982efe08af23",
  "mgr-yakubova-ys": "0481a81d-160b-422e-8257-cf21d134cd42",
  "mgr-fedorov-dv": "f824e678-951d-45c0-9fa8-b97d27f5ad0d",
  "mgr-ponkratova-vv": "4615c9b1-5d5f-4832-85ff-60b8da50e567",
  "mgr-avetisyan-rs": "d80c495f-5229-4ccd-bd2a-14e4301361de",
  "mgr-sklyarov-dv": "dc958e02-d80e-4615-bb8a-8a46be70daed",
  "mgr-orlov-dv": "1526ab0b-db39-4957-887b-056b6549ad62",
  "mgr-agadzhanyan-rs": "9c686222-eebd-46ee-bf6d-d560e8901d04",
  "mgr-doronina-iv": "eae85849-6fea-4bf6-9eee-81bd175c4391",
  "mgr-ilyuchenko-an": "e60f1a83-88ae-41f8-8c32-edd91f666e8d",
  "mgr-miroshnichenko-dn": "c3dca970-b32f-4b23-b3d6-2911250fe81e",
  "mgr-lysenko-eg": "9e6056c9-9c8c-477b-94fd-45dab490e382",
  "mgr-kulakova-os": "6f1ed04c-18a8-412d-a4db-efa8ed2258d6",
  "mgr-koteneva-av": "f2aaf964-37d0-4b8d-b40a-38eb2428fb52",
  "mgr-netkacheva-ia": "2f85e5b1-0633-45d9-9672-72417cd1daa2",
  "mgr-petrichenko-ev": "88518eda-2986-48ad-93e3-92f5f554b54f",
  "mgr-arutyunyan-oa": "3c88c879-81d2-4403-ae2e-67be8e782650",
  "mgr-osmanov-fm": "7168496a-6d43-4471-86cb-8050e7a4e5a1",
  "mgr-chernousova-in": "62dcd67c-d66c-40c6-a349-c71e6e8493c4",
  "mgr-yarysh-si": "f5aad585-f020-4410-a147-36d6ca5d3886",
  "mgr-avedikyan-ka": "fb589859-1858-4725-ae74-d7a6de92ffbe",
};

export const UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE: Record<string, string> = Object.fromEntries(
  Object.entries(MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE).map(([mgrId, uuid]) => [uuid, mgrId]),
);

/**
 * Маппинг UUID реальных пользователей-руководителей (РОП, директор) к persona id из SALES_USERS.
 * Нужен, чтобы при impersonation реального РОПа `release-demo-profile.ts` подбирал корректную
 * persona — иначе `getEffectiveTeamLeadTeamId(profile)` всегда возвращает `team-kupiansky`
 * (defaultPersonaForRole("team_lead")), что ломает picker-фильтры счётчиков (промт 332/334).
 */
export const LEADERS_UUID_TO_PERSONA: Record<string, string> = {
  "ccffcf6e-2505-4eee-b257-ac65b60bb779": "user-tl-kupiansky",
  "c36f625f-730e-4ae3-b118-bdb005d10b81": "user-tl-sapozhkov",
  "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa": "user-tl-skalaban",
  // regional_manager → persona команды из user_team_memberships (fallback demo-path)
  "6fe22f7f-d8bb-4a16-92bb-5382034de831": "user-tl-sapozhkov",
  "10d1abcd-ee9b-42ff-916f-e9d4c43c9bd2": "user-tl-skalaban",
  "88169427-6062-46a1-b292-85eecb109777": "user-tl-skalaban",
  "bb0e6231-8c1e-46ae-9e0f-a1d9003d9b81": "user-tl-kupiansky",
  "bc407508-0bf3-407b-9dcf-6b42de9924ee": "user-tl-kupiansky",
};

export type ManualMergePlanRow = {
  managerUserId: string;
  managerScopeUserId: string;
  managerFullName: string;
  manualDealerId: string;
  manualInternalCode: string;
  manualName: string;
  releaseDealerId: string;
  releaseCode: string;
  releaseName: string;
  tradePointsCount: number;
  hasLegalEntities: boolean;
  hasContacts: boolean;
};

export type ManualMergePlan = {
  rows: ManualMergePlanRow[];
  skipped: Array<{ managerUserId: string; manualDealerId: string; reason: string }>;
};

type ReleaseMatchRow = {
  id: string;
  code: string;
  name: string;
  managerId: string;
};

export function normalizeDealerName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»"'`,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function stringField(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v.trim() : "";
}

function manualDealerName(manual: ManualDealer): string {
  const fields = isRecord(manual.fields) ? manual.fields : {};
  return stringField(fields, "name") || stringField(fields, "dealerName");
}

function releaseMatchesFor(managerUserId: string, normalizedName: string): ReleaseMatchRow[] {
  return RELEASE_CLIENT_ROWS.filter(
    (row) => row.managerId === managerUserId && normalizeDealerName(row.name) === normalizedName,
  ).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    managerId: row.managerId,
  }));
}

export function buildManagerMergePlan(args: {
  managerUserId: string;
  managerScopeUserId: string;
  managerFullName: string;
  state: ActualizationState;
}): ManualMergePlan {
  const rows: ManualMergePlanRow[] = [];
  const skipped: ManualMergePlan["skipped"] = [];
  const manuals = args.state.manuallyCreatedDealersById ?? {};
  const tradePoints = args.state.manuallyCreatedTradePointsById ?? {};

  for (const [manualDealerId, manual] of Object.entries(manuals)) {
    const manualName = manualDealerName(manual);
    const normalizedName = normalizeDealerName(manualName);
    if (!normalizedName) {
      skipped.push({ managerUserId: args.managerUserId, manualDealerId, reason: "empty_manual_name" });
      continue;
    }
    const matches = releaseMatchesFor(args.managerUserId, normalizedName);
    if (matches.length === 0) {
      skipped.push({ managerUserId: args.managerUserId, manualDealerId, reason: "no_release_match" });
      continue;
    }
    if (matches.length > 1) {
      skipped.push({ managerUserId: args.managerUserId, manualDealerId, reason: "ambiguous_release_match" });
      continue;
    }

    const match = matches[0]!;
    const fields = isRecord(manual.fields) ? manual.fields : {};
    rows.push({
      managerUserId: args.managerUserId,
      managerScopeUserId: args.managerScopeUserId,
      managerFullName: args.managerFullName,
      manualDealerId,
      manualInternalCode: manual.internalCode ?? "",
      manualName,
      releaseDealerId: match.id,
      releaseCode: match.code,
      releaseName: match.name,
      tradePointsCount: Object.values(tradePoints).filter((tp) => tp.dealerId === manualDealerId).length,
      hasLegalEntities: args.state.legalEntityOverridesByDealerId?.[manualDealerId] != null,
      hasContacts: Boolean(stringField(fields, "phone") || stringField(fields, "email")),
    });
  }

  return { rows, skipped };
}

function cloneRecord<T>(v: Record<string, T> | undefined): Record<string, T> {
  return { ...(v ?? {}) };
}

function cloneState(state: ActualizationState): ActualizationState {
  return {
    ...state,
    dealerOverridesById: cloneRecord(state.dealerOverridesById),
    manuallyCreatedDealersById: cloneRecord(state.manuallyCreatedDealersById),
    tradePointOverridesById: cloneRecord(state.tradePointOverridesById),
    manuallyCreatedTradePointsById: cloneRecord(state.manuallyCreatedTradePointsById),
    archivedLegalEntitiesById: cloneRecord(state.archivedLegalEntitiesById),
    legalEntityOverridesByDealerId: cloneRecord(state.legalEntityOverridesByDealerId),
    dealerCardViewSettingsByUserId: cloneRecord(state.dealerCardViewSettingsByUserId),
    unloadingOrderByDealerId: cloneRecord(state.unloadingOrderByDealerId),
    routeOrderByRouteId: cloneRecord(state.routeOrderByRouteId),
    dealerActualizationContactsById: cloneRecord(state.dealerActualizationContactsById),
    archivedDealerContactsById: cloneRecord(state.archivedDealerContactsById),
    tradePointShowcaseActualizationById: cloneRecord(state.tradePointShowcaseActualizationById),
    dealerActualizationAuditByDealerId: cloneRecord(state.dealerActualizationAuditByDealerId),
    dealerPhotosByDealerId: cloneRecord(state.dealerPhotosByDealerId),
    tradePointPhotosByTradePointId: cloneRecord(state.tradePointPhotosByTradePointId),
  };
}

function buildReleaseOverride(args: {
  manual: ManualDealer;
  manualOverride: DealerActualizationOverride | undefined;
  existingReleaseOverride: DealerActualizationOverride | undefined;
  releaseDealerId: string;
  actorUserId: string;
  now: string;
}): DealerActualizationOverride {
  const manualFields = isRecord(args.manual.fields) ? args.manual.fields : {};
  const manualOverrideFields = isRecord(args.manualOverride?.fields) ? args.manualOverride.fields : {};
  const existingReleaseFields = isRecord(args.existingReleaseOverride?.fields) ? args.existingReleaseOverride.fields : {};
  const updatedBy = args.manualOverride?.updatedBy || args.manual.updatedBy || args.manual.createdBy || args.actorUserId;
  const updatedByName =
    args.manualOverride?.updatedByName || args.manual.updatedByName || args.manual.createdByName || "actualization-dedupe";
  return {
    ...(args.existingReleaseOverride ?? {}),
    dealerId: args.releaseDealerId,
    fields: { ...existingReleaseFields, ...manualFields, ...manualOverrideFields },
    updatedAt: args.manualOverride?.updatedAt || args.manual.updatedAt || args.manual.createdAt || args.now,
    updatedBy,
    updatedByName,
    source: "manual_actualization",
  };
}

export function applyMergePlanToState(
  state: ActualizationState,
  plan: ManualMergePlan,
  actorUserId = "actualization-dedupe",
): ActualizationState {
  const next = cloneState(state);
  const now = new Date().toISOString();

  for (const row of plan.rows) {
    const manual = next.manuallyCreatedDealersById[row.manualDealerId];
    if (!manual) continue;
    const releaseKey = row.releaseDealerId;
    const manualOverride = next.dealerOverridesById[row.manualDealerId];
    next.dealerOverridesById[releaseKey] = buildReleaseOverride({
      manual,
      manualOverride,
      existingReleaseOverride: next.dealerOverridesById[releaseKey],
      releaseDealerId: releaseKey,
      actorUserId,
      now,
    });
    delete next.dealerOverridesById[row.manualDealerId];

    for (const [tpId, tp] of Object.entries(next.manuallyCreatedTradePointsById)) {
      if (tp.dealerId !== row.manualDealerId) continue;
      next.manuallyCreatedTradePointsById[tpId] = { ...(tp as ManualTradePoint), dealerId: releaseKey };
    }

    const legal = next.legalEntityOverridesByDealerId[row.manualDealerId];
    if (legal != null) {
      next.legalEntityOverridesByDealerId[releaseKey] = legal;
      delete next.legalEntityOverridesByDealerId[row.manualDealerId];
    }
    const unload = next.unloadingOrderByDealerId?.[row.manualDealerId];
    if (unload != null) {
      next.unloadingOrderByDealerId = { ...(next.unloadingOrderByDealerId ?? {}), [releaseKey]: unload };
      delete next.unloadingOrderByDealerId[row.manualDealerId];
    }
    const photos = next.dealerPhotosByDealerId?.[row.manualDealerId];
    if (photos != null) {
      next.dealerPhotosByDealerId = { ...(next.dealerPhotosByDealerId ?? {}), [releaseKey]: photos };
      delete next.dealerPhotosByDealerId[row.manualDealerId];
    }
    for (const [contactId, contact] of Object.entries(next.dealerActualizationContactsById ?? {})) {
      if (contact.dealerId === row.manualDealerId) {
        next.dealerActualizationContactsById[contactId] = { ...contact, dealerId: releaseKey };
      }
    }
    for (const [contactId, info] of Object.entries(next.archivedDealerContactsById ?? {})) {
      if (info.dealerId === row.manualDealerId) {
        next.archivedDealerContactsById[contactId] = { ...info, dealerId: releaseKey };
      }
    }
    const audit = next.dealerActualizationAuditByDealerId?.[row.manualDealerId];
    if (audit != null) {
      next.dealerActualizationAuditByDealerId = {
        ...(next.dealerActualizationAuditByDealerId ?? {}),
        [releaseKey]: audit,
      };
      delete next.dealerActualizationAuditByDealerId[row.manualDealerId];
    }

    delete next.manuallyCreatedDealersById[row.manualDealerId];
  }

  next.updatedAt = now;
  next.updatedBy = actorUserId;
  return next;
}
