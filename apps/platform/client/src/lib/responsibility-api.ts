/**
 * HTTP API матрицы ответственных (Промт 234).
 */

import { apiRequest } from "./queryClient.js";

export type ResponsibleRole = "manager" | "regional_manager" | "rop";

export interface ResolvedResponsible {
  userId: string | null;
  userName: string | null;
  source: "assignment" | "legacy" | null;
  sourceLevel: "trade_point" | "client" | "city" | "team" | null;
}

export interface ResolvedResponsibles {
  manager: ResolvedResponsible;
  regional_manager: ResolvedResponsible;
  rop: ResolvedResponsible;
}

export interface ClientResponsibles {
  /** Резолв на уровне клиента (берётся из первой точки; null, если у клиента нет точек). */
  resolved: ResolvedResponsibles | null;
  /** Роли, по которым у точек клиента разные ответственные. */
  sharedByRole: { manager?: boolean; regional_manager?: boolean; rop?: boolean };
  /** Кол-во торговых точек клиента. */
  tradePointsCount: number;
}

export interface PickerUser {
  id: string;
  full_name: string;
  role: string;
  status: string;
}

type ApiErr = { success: false; message?: string; code?: string };

export class ResponsibilityApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ResponsibilityApiError";
    this.code = code;
  }
}

function parseApiError(json: { success?: boolean; message?: string; code?: string }, fallback: string): ResponsibilityApiError {
  return new ResponsibilityApiError(json.message ?? fallback, json.code);
}

function parseApiRequestFailure(error: unknown, fallback: string): ResponsibilityApiError {
  if (!(error instanceof Error)) return new ResponsibilityApiError(fallback);
  const match = error.message.match(/^(\d+):\s*([\s\S]+)$/);
  if (!match?.[1]) return new ResponsibilityApiError(error.message || fallback);
  try {
    const json = JSON.parse(match[1]) as ApiErr;
    if (json.success === false || json.message || json.code) {
      return parseApiError(json, fallback);
    }
  } catch {
    // not JSON — keep raw message
  }
  return new ResponsibilityApiError(error.message || fallback);
}

async function readJson<T extends { success?: boolean }>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchResolveTradePoint(tradePointId: string): Promise<ResolvedResponsibles> {
  try {
    const res = await apiRequest(
      "GET",
      `/api/responsibility/resolve?tradePointId=${encodeURIComponent(tradePointId)}`,
    );
    const json = await readJson<{ success: true; resolved: ResolvedResponsibles } | ApiErr>(res);
    if (json.success !== true) {
      throw parseApiError(json, "Не удалось загрузить ответственных");
    }
    return json.resolved;
  } catch (e) {
    if (e instanceof ResponsibilityApiError) throw e;
    throw parseApiRequestFailure(e, "Не удалось загрузить ответственных");
  }
}

export async function fetchResolveClient(dealerId: string): Promise<ClientResponsibles> {
  try {
    const res = await apiRequest(
      "GET",
      `/api/responsibility/client?dealerId=${encodeURIComponent(dealerId)}`,
    );
    const json = await readJson<
      | {
          success: true;
          tradePoints: Array<{ resolved: ResolvedResponsibles }>;
          sharedByRole: { manager?: boolean; regional_manager?: boolean; rop?: boolean };
        }
      | ApiErr
    >(res);
    if (json.success !== true || !Array.isArray(json.tradePoints)) {
      throw parseApiError(json, "Не удалось загрузить ответственных клиента");
    }
    return {
      resolved: json.tradePoints[0]?.resolved ?? null,
      sharedByRole: json.sharedByRole ?? {},
      tradePointsCount: json.tradePoints.length,
    };
  } catch (e) {
    if (e instanceof ResponsibilityApiError) throw e;
    throw parseApiRequestFailure(e, "Не удалось загрузить ответственных клиента");
  }
}

export async function fetchUsersForRole(role: ResponsibleRole): Promise<PickerUser[]> {
  try {
    const res = await apiRequest("GET", `/api/users/picker?role=${encodeURIComponent(role)}`);
    const json = await readJson<{ success: true; users: PickerUser[] } | ApiErr>(res);
    if (json.success !== true || !Array.isArray(json.users)) {
      throw parseApiError(json, "Не удалось загрузить список сотрудников");
    }
    return json.users;
  } catch (e) {
    if (e instanceof ResponsibilityApiError) throw e;
    throw parseApiRequestFailure(e, "Не удалось загрузить список сотрудников");
  }
}

export async function assignResponsible(input: {
  scopeKind: "trade_point" | "client" | "city";
  scopeKey: string;
  role: ResponsibleRole;
  userId: string | null;
  reason?: string;
}): Promise<void> {
  try {
    const res = await apiRequest("POST", "/api/responsibility/assign", input);
    const json = await readJson<{ success: true } | ApiErr>(res);
    if (json.success !== true) {
      throw parseApiError(json, "Не удалось назначить ответственного");
    }
  } catch (e) {
    if (e instanceof ResponsibilityApiError) throw e;
    throw parseApiRequestFailure(e, "Не удалось назначить ответственного");
  }
}
