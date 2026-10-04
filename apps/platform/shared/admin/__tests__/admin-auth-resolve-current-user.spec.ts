/**
 * resolveCurrentUser regression — real helper, synthetic PoolLike session rows.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  parseAuthRefreshToken,
  resolveCurrentUser,
  resolveActiveSessionUser,
  timingSafeEqualHex,
} from "../admin-auth.js";
import type { PoolLike } from "../admin-auth.js";

const USER_ID = "10000000-0000-4000-8000-000000000090";
const TOKEN_ACTIVE = "test-refresh-token-active";
const TOKEN_EXPIRED = "test-refresh-token-expired";
const TOKEN_REVOKED = "test-refresh-token-revoked";
const TOKEN_BAD = "test-refresh-token-bad-hash";

function hash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

type SessionRow = {
  refresh_token_hash: string;
  revoked_at: string | null;
  expires_at: Date;
  status: string;
};

const sessions: SessionRow[] = [
  {
    refresh_token_hash: hash(TOKEN_ACTIVE),
    revoked_at: null,
    expires_at: new Date(Date.now() + 3600_000),
    status: "active",
  },
  {
    refresh_token_hash: hash(TOKEN_EXPIRED),
    revoked_at: null,
    expires_at: new Date(Date.now() - 3600_000),
    status: "active",
  },
  {
    refresh_token_hash: hash(TOKEN_REVOKED),
    revoked_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000),
    status: "active",
  },
  {
    refresh_token_hash: hash(TOKEN_BAD),
    revoked_at: null,
    expires_at: new Date(Date.now() + 3600_000),
    status: "active",
  },
];

function pool(): PoolLike {
  return {
    query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM sessions") && s.includes("refresh_token_hash = $1")) {
        const h = String(params?.[0] ?? "");
        const row = sessions.find((x) => x.refresh_token_hash === h);
        if (!row || row.revoked_at || row.expires_at <= new Date()) return { rows: [] as T[] };
        if (h === hash(TOKEN_BAD)) {
          return {
            rows: [
              {
                id: USER_ID,
                email: "admin@test.ru",
                full_name: "Admin",
                phone: null,
                role: "admin",
                status: row.status,
                must_change_password: false,
                last_login_at: null,
                created_at: new Date().toISOString(),
                refresh_token_hash: "deadbeef",
              },
            ] as T[],
          };
        }
        return {
          rows: [
            {
              id: USER_ID,
              email: "admin@test.ru",
              full_name: "Admin",
              phone: null,
              role: "admin",
              status: row.status,
              must_change_password: false,
              last_login_at: null,
              created_at: new Date().toISOString(),
              refresh_token_hash: row.refresh_token_hash,
            },
          ] as T[],
        };
      }
      return { rows: [] as T[] };
    },
  };
}

describe("resolveCurrentUser", () => {
  it("validates token with timingSafeEqualHex", () => {
    expect(timingSafeEqualHex(hash(TOKEN_ACTIVE), TOKEN_ACTIVE)).toBe(true);
    expect(timingSafeEqualHex(hash(TOKEN_ACTIVE), TOKEN_BAD)).toBe(false);
  });

  it("resolves active session", async () => {
    const cookie = `tandoor_auth_sess=${encodeURIComponent(TOKEN_ACTIVE)}`;
    expect(parseAuthRefreshToken(cookie)).toBe(TOKEN_ACTIVE);
    const user = await resolveCurrentUser(pool(), { cookie });
    expect(user?.id).toBe(USER_ID);
  });

  it("rejects expired session", async () => {
    const user = await resolveCurrentUser(pool(), {
      cookie: `tandoor_auth_sess=${encodeURIComponent(TOKEN_EXPIRED)}`,
    });
    expect(user).toBeNull();
  });

  it("rejects revoked session", async () => {
    const user = await resolveCurrentUser(pool(), {
      cookie: `tandoor_auth_sess=${encodeURIComponent(TOKEN_REVOKED)}`,
    });
    expect(user).toBeNull();
  });

  it("rejects hash mismatch", async () => {
    const user = await resolveCurrentUser(pool(), {
      cookie: `tandoor_auth_sess=${encodeURIComponent(TOKEN_BAD)}`,
    });
    expect(user).toBeNull();
  });

  it("resolveActiveSessionUser requires active status", async () => {
    const cookie = `tandoor_auth_sess=${encodeURIComponent(TOKEN_ACTIVE)}`;
    sessions[0]!.status = "invited";
    expect(await resolveActiveSessionUser(pool(), { cookie })).toBeNull();
    sessions[0]!.status = "active";
    expect(await resolveActiveSessionUser(pool(), { cookie })).not.toBeNull();
  });
});
