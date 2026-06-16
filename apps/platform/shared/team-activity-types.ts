/**
 * Типы API «Активность команды» (Промт 378).
 */

export type TeamActivityRange = "7d" | "30d";

export type ActivitySummaryJson = {
  events_7d?: number;
  events_overrides_7d?: number;
  events_contacts_7d?: number;
  events_tp_7d?: number;
  clients_touched_7d?: number;
  events_30d?: number;
  events_overrides_30d?: number;
  events_contacts_30d?: number;
  events_tp_30d?: number;
  clients_touched_30d?: number;
  last_activity_at?: string | null;
};

export type TeamActivityRow = {
  user_id: string;
  full_name: string;
  role: string;
  team_id: string | null;
  team_name: string | null;
  clients_count: number;
  events_total: number;
  events_overrides: number;
  events_contacts: number;
  events_tp: number;
  clients_touched: number;
  last_activity_at: string | null;
  last_login_at: string | null;
  days_since_activity: number | null;
};

export type TeamActivityTeamOption = {
  team_id: string;
  team_name: string;
};

export type TeamActivityListResponse = {
  success: true;
  range: TeamActivityRange;
  teams: TeamActivityTeamOption[];
  rows: TeamActivityRow[];
  generated_at: string;
};

export type TeamActivityEventType = "override" | "contact" | "tp";

export type TeamActivityEventRow = {
  at: string;
  type: TeamActivityEventType;
  dealer_id: string | null;
  client_id: string | null;
  field: string | null;
  body_preview: string | null;
};

export type TeamActivityEventsResponse = {
  success: true;
  user_id: string;
  range: TeamActivityRange;
  events: TeamActivityEventRow[];
};

export type RefreshActivitySummaryResult = {
  success: true;
  rows_in_daily: number;
  users_updated: number;
  duration_ms: number;
};
