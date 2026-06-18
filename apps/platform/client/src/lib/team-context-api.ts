/**
 * GET /api/team/context — клиент (Промт 398).
 */
import { apiRequest } from "./queryClient";

export type TeamContextPayload = {
  success: true;
  teamId: string | null;
  teamMemberIds: string[];
  teamCodes: string[];
};

export const TEAM_CONTEXT_QUERY_KEY = ["team", "context"] as const;

export async function fetchTeamContext(): Promise<TeamContextPayload> {
  const res = await apiRequest("GET", "/api/team/context");
  const body = (await res.json()) as TeamContextPayload & { success?: boolean };
  if (!body?.success) {
    throw new Error("team context fetch failed");
  }
  return body;
}
