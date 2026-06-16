/**
 * Сборка ответа GET /api/bootstrap — ядро с инъекцией зависимостей (Промт 380).
 */

import type { PoolLike, DbUserRow } from "./admin/admin-auth.js";
import { hashEtag } from "./api-lru-cache.js";
import {
  buildOrgSnapshotPayload,
  buildVisibleClientsPayload,
  type OrgSnapshotPayload,
  type VisibleClientsPayload,
} from "./auth-session-scope.js";

export type BootstrapSection =
  | "user"
  | "feature_flags"
  | "my_client_codes"
  | "my_org_snapshot"
  | "my_visible_codes"
  | "actualization_state";

export type BootstrapResponse = {
  user?: Record<string, unknown>;
  feature_flags?: Record<string, unknown>;
  my_client_codes?: Record<string, unknown>;
  my_org_snapshot?: OrgSnapshotPayload;
  my_visible_codes?: VisibleClientsPayload & { success: true };
  actualization_state?: Record<string, unknown>;
  server_time: string;
  etag: string;
  errors?: BootstrapSection[];
};

export type BootstrapLoaders = {
  fetchMyClientCodes: (pool: PoolLike, user: { id: string; role: string }) => Promise<Record<string, unknown>>;
  getFeatureFlags: () => Record<string, unknown>;
  loadActualizationState: (userId: string, role: string) => Promise<Record<string, unknown>>;
};

type SectionResult<T> = { ok: true; value: T } | { ok: false; section: BootstrapSection };

async function runSection<T>(section: BootstrapSection, fn: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bootstrap]", section, m.slice(0, 200));
    return { ok: false, section };
  }
}

function userToDbRow(user: Record<string, unknown>): DbUserRow {
  return {
    id: String(user.id ?? ""),
    email: String(user.email ?? ""),
    full_name: String(user.fullName ?? user.full_name ?? ""),
    phone: (user.phone as string | null) ?? null,
    role: String(user.role ?? ""),
    status: String(user.status ?? "active"),
    must_change_password: Boolean(user.mustChangePassword ?? user.must_change_password),
    last_login_at: (user.lastLoginAt as string | null) ?? null,
    created_at: (user.createdAt as string | null) ?? new Date().toISOString(),
    telegram_user_id: null,
  };
}

export async function buildBootstrapPayloadCore(
  pool: PoolLike,
  user: Record<string, unknown>,
  loaders: BootstrapLoaders,
): Promise<BootstrapResponse> {
  const userId = String(user.id ?? "");
  const role = String(user.role ?? "");
  const dbRow = userToDbRow(user);

  const [flagsR, codesR, orgR, visibleR, actR] = await Promise.all([
    runSection("feature_flags", async () => loaders.getFeatureFlags()),
    runSection("my_client_codes", async () => loaders.fetchMyClientCodes(pool, { id: userId, role })),
    runSection("my_org_snapshot", async () => buildOrgSnapshotPayload(pool, dbRow)),
    runSection("my_visible_codes", async () => {
      const vis = await buildVisibleClientsPayload(pool, dbRow);
      return { success: true as const, ...vis };
    }),
    runSection("actualization_state", async () => loaders.loadActualizationState(userId, role)),
  ]);

  const errors: BootstrapSection[] = [];
  const body: BootstrapResponse = {
    user,
    server_time: new Date().toISOString(),
    etag: "",
  };

  if (flagsR.ok) body.feature_flags = flagsR.value;
  else errors.push(flagsR.section);

  if (codesR.ok) body.my_client_codes = codesR.value;
  else errors.push(codesR.section);

  if (orgR.ok) body.my_org_snapshot = orgR.value;
  else errors.push(orgR.section);

  if (visibleR.ok) body.my_visible_codes = visibleR.value;
  else errors.push(visibleR.section);

  if (actR.ok) body.actualization_state = actR.value;
  else errors.push(actR.section);

  if (errors.length > 0) body.errors = errors;

  const { etag: _ignored, server_time: _st, ...forHash } = body;
  body.etag = hashEtag(forHash);

  return body;
}

export function bootstrapCacheKey(userId: string, role: string): string {
  return `bootstrap:${userId}:${role}:`;
}
