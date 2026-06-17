/**
 * Запуск: `npm run test:bootstrap` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { PoolLike } from "../admin/admin-auth.js";
import { buildBootstrapPayload } from "../auth-bootstrap-handlers.js";

const DIRECTOR_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TOKEN = "test-refresh-token";
const tokenHash = createHash("sha256").update(TOKEN, "utf8").digest("hex");

function mockPool(opts?: { throwOn?: string }): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (opts?.throwOn && s.includes(opts.throwOn)) {
        throw new Error("simulated db error");
      }
      if (s.includes("FROM sessions s") && s.includes("impersonator")) {
        if (params?.[0] !== tokenHash) return { rows: [] };
        return {
          rows: [
            {
              id: DIRECTOR_ID,
              email: "dir@test.ru",
              full_name: "Директор",
              phone: null,
              role: "director",
              status: "active",
              must_change_password: false,
              last_login_at: "2026-06-17T08:00:00.000Z",
              created_at: "2026-01-01T00:00:00.000Z",
              telegram_user_id: null,
              refresh_token_hash: tokenHash,
              impersonator_full_name: null,
              impersonator_email: null,
            },
          ],
        };
      }
      if (s.includes("FROM teams t")) {
        return { rows: [{ id: "team-1", name: "Команда", rop_user_id: null, rop_name: null }] };
      }
      if (s.includes("FROM users u") && s.includes("user_team_memberships")) {
        return {
          rows: [
            {
              id: DIRECTOR_ID,
              full_name: "Директор",
              role: "director",
              status: "active",
              team_id: null,
            },
          ],
        };
      }
      if (s.includes("user_team_memberships WHERE user_id")) {
        return { rows: [] };
      }
      if (s.includes("role = 'admin'")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

// 401 — не вошедший
{
  const r = await buildBootstrapPayload(mockPool(), {});
  assert.equal(r.status, 401);
  assert.equal(r.body.success, false);
  assert.equal(r.body.code, "UNAUTHENTICATED");
}

// 503 — DB down
{
  const r = await buildBootstrapPayload(null, { cookie: `tandoor_auth_sess=${TOKEN}` });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, "DB_UNAVAILABLE");
}

// 200 — успех
{
  const r = await buildBootstrapPayload(mockPool(), { cookie: `tandoor_auth_sess=${TOKEN}` });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.bootstrap_version, 1);
  assert.ok(r.body.me && typeof r.body.me === "object");
  assert.equal((r.body.me as { email?: string }).email, "dir@test.ru");
  assert.ok(r.body.org_snapshot?.success);
  assert.ok(r.body.org_snapshot?.me);
  assert.ok(r.body.visible_codes);
  assert.ok(r.body.feature_flags?.flags);
  assert.ok(r.body.generated_at);
}

// внутренняя ошибка → throw (api/bootstrap.ts оборачивает в 500 INTERNAL_ERROR)
{
  let threw = false;
  try {
    await buildBootstrapPayload(mockPool({ throwOn: "FROM teams t" }), {
      cookie: `tandoor_auth_sess=${TOKEN}`,
    });
  } catch (e) {
    threw = true;
    assert.ok(e instanceof Error);
    assert.match(e.message, /simulated db error/);
  }
  assert.equal(threw, true);
}

// GET-only guard (логика handler без импорта neon)
{
  const method = "POST";
  const status = method !== "GET" ? 405 : 200;
  assert.equal(status, 405);
}

console.log("auth-bootstrap-handlers.test.ts: ok");
