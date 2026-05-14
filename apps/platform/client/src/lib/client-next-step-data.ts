/**
 * «Следующий шаг» по клиенту: sessionStorage без backend.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import type { SalesRole } from "@/lib/sales-control-data";

export const CLIENT_NEXT_STEP_STORAGE_KEY = "tandoor-client-next-steps-v1";

export const CLIENT_NEXT_STEP_CHANGED_EVENT = "tandoor-client-next-step-changed";

export type ClientNextStepActionType = "call" | "visit" | "message" | "showcase_check";

export type ClientNextStepRecord = {
  actionType: ClientNextStepActionType;
  contactDate: string;
  comment: string;
  updatedAt: string;
  updatedByUserId: string;
  updatedByLabel: string;
};

export type ClientNextStepHistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

type ClientNextStepsStorageV1 = {
  steps: Record<string, ClientNextStepRecord>;
  historyByDealer: Record<string, ClientNextStepHistoryEntry[]>;
};

function emptyStorage(): ClientNextStepsStorageV1 {
  return { steps: {}, historyByDealer: {} };
}

export function loadClientNextStepsStorage(): ClientNextStepsStorageV1 {
  if (typeof window === "undefined") return emptyStorage();
  try {
    const raw = window.sessionStorage.getItem(CLIENT_NEXT_STEP_STORAGE_KEY);
    if (!raw) return emptyStorage();
    const parsed = JSON.parse(raw) as Partial<ClientNextStepsStorageV1>;
    return {
      steps: parsed.steps && typeof parsed.steps === "object" ? parsed.steps : {},
      historyByDealer:
        parsed.historyByDealer && typeof parsed.historyByDealer === "object" ? parsed.historyByDealer : {},
    };
  } catch {
    return emptyStorage();
  }
}

export function saveClientNextStepsStorage(data: ClientNextStepsStorageV1): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CLIENT_NEXT_STEP_STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(CLIENT_NEXT_STEP_CHANGED_EVENT));
}

export function getClientNextStepForDealer(dealerId: string, storage: ClientNextStepsStorageV1): ClientNextStepRecord | null {
  return storage.steps[dealerId] ?? null;
}

export function getClientNextStepHistoryForDealer(dealerId: string, storage: ClientNextStepsStorageV1): ClientNextStepHistoryEntry[] {
  return [...(storage.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function clientNextStepActionLabel(t: ClientNextStepActionType): string {
  switch (t) {
    case "call":
      return "звонок";
    case "visit":
      return "визит";
    case "message":
      return "сообщение";
    case "showcase_check":
      return "проверка витрины";
    default:
      return "действие";
  }
}

function formatRuDateFromIso(isoDay: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay.trim());
  if (!m) return isoDay;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function formatNextStepHistoryBody(
  actionType: ClientNextStepActionType,
  contactDate: string,
  comment: string,
): string {
  const act = clientNextStepActionLabel(actionType);
  const when = formatRuDateFromIso(contactDate);
  const tail = comment.trim() ? `: ${comment.trim()}` : "";
  if (actionType === "showcase_check") {
    return `Запланирована проверка витрины на ${when}${tail}`;
  }
  if (actionType === "visit") {
    return `Запланирован визит на ${when}${tail}`;
  }
  if (actionType === "call") {
    return `Запланирован звонок на ${when}${tail}`;
  }
  return `Запланировано сообщение на ${when}${tail}`;
}

export function saveClientNextStep(
  dealerId: string,
  payload: Omit<ClientNextStepRecord, "updatedAt" | "updatedByUserId" | "updatedByLabel"> & {
    updatedByUserId: string;
    updatedByLabel: string;
  },
): ClientNextStepsStorageV1 {
  const storage = loadClientNextStepsStorage();
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const rec: ClientNextStepRecord = {
    ...payload,
    updatedAt: now,
    updatedByUserId: payload.updatedByUserId,
    updatedByLabel: payload.updatedByLabel,
  };
  storage.steps[dealerId] = rec;

  const metaDay = formatRuDateFromIso(day);
  const meta = `${metaDay} · ${payload.updatedByLabel}`;
  const body = formatNextStepHistoryBody(payload.actionType, payload.contactDate, payload.comment);
  const hist: ClientNextStepHistoryEntry = {
    id: `ns-${dealerId}-${Date.now()}`,
    at: now,
    meta,
    body,
  };
  const prev = storage.historyByDealer[dealerId] ?? [];
  storage.historyByDealer[dealerId] = [hist, ...prev].slice(0, 60);

  saveClientNextStepsStorage(storage);
  return storage;
}

/** Редактирование: менеджер своего клиента, РОП команды, руководитель продаж; маркетолог и аналитик — только просмотр. */
export function canEditClientNextStep(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  const role = profile.role as SalesRole;
  if (role === "marketer" || role === "analyst") return false;
  if (role === "sales_director") return true;
  if (role === "sales_manager") return dealer.releaseManagerId === profile.personaUserId;
  if (role === "team_lead") return dealer.releaseTeamId === getEffectiveTeamLeadTeamId(profile);
  return false;
}
