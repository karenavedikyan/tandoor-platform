/**
 * Client API: активность команды (Промт 378).
 */

import type {
  TeamActivityEventsResponse,
  TeamActivityListResponse,
  TeamActivityRange,
} from "@shared/team-activity-types";

type ApiError = {
  success: false;
  code: string;
  message: string;
};

async function parseJson<T>(res: Response): Promise<T | ApiError> {
  return (await res.json()) as T | ApiError;
}

export async function fetchTeamActivityList(opts?: {
  range?: TeamActivityRange;
  teamId?: string | null;
}): Promise<TeamActivityListResponse | ApiError> {
  const params = new URLSearchParams();
  if (opts?.range) params.set("range", opts.range);
  if (opts?.teamId) params.set("team_id", opts.teamId);
  const qs = params.toString();
  const res = await fetch(`/api/team-activity${qs ? `?${qs}` : ""}`, { credentials: "include" });
  return parseJson<TeamActivityListResponse>(res);
}

export async function fetchTeamActivityEvents(
  userId: string,
  opts?: { range?: TeamActivityRange; limit?: number },
): Promise<TeamActivityEventsResponse | ApiError> {
  const params = new URLSearchParams();
  if (opts?.range) params.set("range", opts.range);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`/api/team-activity/${encodeURIComponent(userId)}/events${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  return parseJson<TeamActivityEventsResponse>(res);
}
