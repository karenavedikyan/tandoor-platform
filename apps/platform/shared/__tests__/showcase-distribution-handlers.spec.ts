import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PoolLike } from "../../server/db/neon-client.js";
import {
  handleShowcaseDistributionGlobalTasks,
  handleShowcaseDistributionOverride,
  handleShowcaseDistributionRecommendation,
  handleShowcaseDistributionState,
  handleShowcaseDistributionTaskComplete,
  handleShowcaseDistributionTaskStatus,
  ShowcaseDistributionForbiddenError,
  type ShowcaseDistributionSessionUser,
} from "../showcase-distribution-handlers.js";

const DEALER_ID = "client-ma001";
const MANAGER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MANAGER_ID = "22222222-2222-4222-8222-222222222222";
const ROP_ID = "33333333-3333-4333-8333-333333333333";
const ANALYST_ID = "44444444-4444-4444-8444-444444444444";
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const TEAM_ID = "66666666-6666-4666-8666-666666666666";

const MANAGER: ShowcaseDistributionSessionUser = {
  id: MANAGER_ID,
  role: "manager",
  status: "active",
  fullName: "Test Manager",
};

const OTHER_MANAGER: ShowcaseDistributionSessionUser = {
  id: OTHER_MANAGER_ID,
  role: "manager",
  status: "active",
  fullName: "Other Manager",
};

const ANALYST: ShowcaseDistributionSessionUser = {
  id: ANALYST_ID,
  role: "analyst",
  status: "active",
  fullName: "Test Analyst",
};

const ADMIN: ShowcaseDistributionSessionUser = {
  id: ADMIN_ID,
  role: "admin",
  status: "active",
  fullName: "Test Admin",
};

type Row = Record<string, unknown>;

class InMemoryShowcaseDistributionDb implements PoolLike {
  overrides = new Map<string, Row>();
  taskUpdates = new Map<string, Row>();
  history: Row[] = [];
  recommendations = new Map<string, Row>();
  clientAssignments: Row[] = [
    { client_code: "MA001", responsible_user_id: MANAGER_ID, team_id: TEAM_ID },
  ];
  teams: Row[] = [{ id: TEAM_ID, rop_user_id: ROP_ID }];
  dealerOverrides: Row[] = [
    { dealer_id: DEALER_ID, name: "Dealer MA001", client_category: "top150", regional_manager_id: null },
  ];

  query<T = Row>(text: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount?: number }> {
    const sql = text.trim();

    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }

    if (sql.includes("FROM client_assignments WHERE client_code")) {
      const [code, userId] = params as [string, string];
      const row = this.clientAssignments.find(
        (r) => r.client_code === code && r.responsible_user_id === userId,
      );
      return Promise.resolve({ rows: row ? [row as T] : [] });
    }

    if (sql.includes("FROM client_assignments ca") && sql.includes("teams t")) {
      const [code, ropUserId] = params as [string, string];
      const ca = this.clientAssignments.find((r) => r.client_code === code);
      if (!ca) return Promise.resolve({ rows: [] });
      const team = this.teams.find((t) => t.id === ca.team_id && t.rop_user_id === ropUserId);
      return Promise.resolve({ rows: team ? [{ "1": 1 } as T] : [] });
    }

    if (sql.includes("FROM dealer_overrides WHERE dealer_id = $1 AND regional_manager_id")) {
      const [dealerId, rmId] = params as [string, string];
      const row = this.dealerOverrides.find(
        (r) => r.dealer_id === dealerId && r.regional_manager_id === rmId,
      );
      return Promise.resolve({ rows: row ? [row as T] : [] });
    }

    if (sql.includes("client_category FROM dealer_overrides WHERE dealer_id")) {
      const dealerId = params[0] as string;
      const row = this.dealerOverrides.find((r) => r.dealer_id === dealerId);
      return Promise.resolve({ rows: row ? [{ client_category: row.client_category } as T] : [] });
    }

    if (sql.includes("FROM dealer_overrides dov") && sql.includes("responsible_user_id = $1")) {
      const userId = params[0] as string;
      const rows = this.dealerOverrides.filter((d) =>
        this.clientAssignments.some(
          (ca) =>
            ca.responsible_user_id === userId &&
            String(d.dealer_id).toUpperCase().replace("CLIENT-", "") === ca.client_code,
        ),
      );
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.includes("FROM dealer_overrides dov") && sql.includes("rop_user_id = $1")) {
      const ropUserId = params[0] as string;
      const teamIds = this.teams.filter((t) => t.rop_user_id === ropUserId).map((t) => t.id);
      const rows = this.dealerOverrides.filter((d) =>
        this.clientAssignments.some(
          (ca) =>
            teamIds.includes(ca.team_id as string) &&
            String(d.dealer_id).toUpperCase().replace("CLIENT-", "") === ca.client_code,
        ),
      );
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.includes("FROM dealer_overrides dov") && sql.includes("ORDER BY dov.dealer_id")) {
      return Promise.resolve({ rows: this.dealerOverrides as T[] });
    }

    if (sql.includes("FROM showcase_distribution_overrides WHERE dealer_id")) {
      const dealerId = params[0] as string;
      const rows = [...this.overrides.values()].filter((r) => r.dealer_id === dealerId);
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.includes("FROM showcase_distribution_task_updates WHERE dealer_id")) {
      const dealerId = params[0] as string;
      const rows = [...this.taskUpdates.values()].filter((r) => r.dealer_id === dealerId);
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.includes("FROM showcase_distribution_history") && sql.includes("WHERE dealer_id")) {
      const dealerId = params[0] as string;
      const rows = this.history
        .filter((r) => r.dealer_id === dealerId)
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .slice(0, 40);
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.includes("FROM showcase_distribution_recommendations WHERE dealer_id")) {
      const dealerId = params[0] as string;
      const rows = [...this.recommendations.values()].filter((r) => r.dealer_id === dealerId);
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.includes("INSERT INTO showcase_distribution_task_updates")) {
      const taskId = params[0] as string;
      const existing = this.taskUpdates.get(taskId);
      const row: Row = existing
        ? {
            ...existing,
            status: params[3] ?? params[sql.includes("'done'") ? 3 : 3],
            result_comment: params[3] === "done" ? params[3] : (params[3] ?? existing.result_comment),
            updated_at: new Date().toISOString(),
            updated_by: params[params.length - 2],
            updated_by_name: params[params.length - 1],
          }
        : {
            task_id: taskId,
            dealer_id: params[1],
            category_id: params[2],
            status: sql.includes("'done'") ? "done" : params[3],
            result_comment: params.length > 10 ? params[3] : null,
            next_action_date: params.length > 10 ? params[4] : null,
            next_action_text: params.length > 10 ? params[5] : null,
            completed_at: params.length > 10 ? params[6] : null,
            result_kind: params.length > 10 ? params[7] : null,
            resolved_actual_count: params.length > 10 ? params[8] : null,
            updated_at: new Date().toISOString(),
            updated_by: params[params.length - 2],
            updated_by_name: params[params.length - 1],
          };

      if (sql.includes("ON CONFLICT (task_id)")) {
        if (params.length <= 6) {
          row.status = params[3];
        } else {
          row.status = "done";
          row.result_comment = params[3];
          row.next_action_date = params[4];
          row.next_action_text = params[5];
          row.completed_at = params[6];
          row.result_kind = params[7];
          row.resolved_actual_count = params[8];
        }
        row.updated_by = params[params.length - 2];
        row.updated_by_name = params[params.length - 1];
      }
      this.taskUpdates.set(taskId, row);
      return Promise.resolve({ rows: [row as T], rowCount: 1 });
    }

    if (sql.includes("INSERT INTO showcase_distribution_overrides")) {
      const key = `${params[0]}|${params[1]}`;
      const row: Row = {
        dealer_id: params[0],
        category_id: params[1],
        actual_count: params[2],
        status: params[3],
        comment: params[4] ?? null,
        updated_at: new Date().toISOString(),
        updated_by: params[params.length - 2],
        updated_by_name: params[params.length - 1],
      };
      this.overrides.set(key, row);
      return Promise.resolve({ rows: [row as T], rowCount: 1 });
    }

    if (sql.includes("INSERT INTO showcase_distribution_history")) {
      const row: Row = {
        id: params[0],
        dealer_id: params[1],
        at: new Date().toISOString(),
        meta: params[2] ?? params[3],
        body: params[3] ?? params[4],
        actor_id: params[4] ?? params[5],
        actor_name: params[5] ?? params[6],
      };
      this.history.push(row);
      return Promise.resolve({ rows: [row as T], rowCount: 1 });
    }

    if (sql.includes("INSERT INTO showcase_distribution_recommendations")) {
      const key = `${params[0]}|${params[1]}`;
      if (sql.includes("ON CONFLICT") && this.recommendations.has(key)) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      const row: Row = {
        dealer_id: params[0],
        model_id: params[1],
        model_label: params[2],
        category_id: params[3],
        bucket: params[4],
        reason: params[5],
        created_at: new Date().toISOString(),
        created_by: params[6],
        created_by_name: params[7],
      };
      this.recommendations.set(key, row);
      return Promise.resolve({ rows: [row as T], rowCount: 1 });
    }

    return Promise.resolve({ rows: [], rowCount: 0 });
  }
}

describe("showcase-distribution-handlers (prompt 426)", () => {
  it("returns state for manager's own dealer", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    const result = await handleShowcaseDistributionState(pool, MANAGER, DEALER_ID);
    expect(result.success).toBe(true);
    expect(result.state.overrides).toEqual({});
  });

  it("denies manager viewing another dealer's state", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    await expect(handleShowcaseDistributionState(pool, OTHER_MANAGER, DEALER_ID)).rejects.toBeInstanceOf(
      ShowcaseDistributionForbiddenError,
    );
  });

  it("lists global tasks scoped to accessible dealers", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    const { tasks } = await handleShowcaseDistributionGlobalTasks(pool, MANAGER);
    expect(tasks.every((t) => t.dealerId === DEALER_ID)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it("completes task atomically (overrides + task_updates + history)", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    const taskId = `sd-${DEALER_ID}-entrance_doors`;
    const result = await handleShowcaseDistributionTaskComplete(pool, MANAGER, {
      dealerId: DEALER_ID,
      taskId,
      categoryId: "entrance_doors",
      newActualCount: 8,
      resultKind: "added_models",
      comment: "Добавил образцы",
    });
    expect(result.success).toBe(true);
    expect(result.state.taskUpdates[taskId]?.status).toBe("done");
    expect(result.state.taskUpdates[taskId]?.resolvedActualCount).toBe(8);
    expect(result.state.overrides[`${DEALER_ID}|entrance_doors`]?.actualCount).toBe(8);
    expect(pool.history.length).toBe(1);
  });

  it("last concurrent task-complete wins", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    const taskId = `sd-${DEALER_ID}-hardware`;
    await handleShowcaseDistributionTaskComplete(pool, MANAGER, {
      dealerId: DEALER_ID,
      taskId,
      categoryId: "hardware",
      newActualCount: 3,
      resultKind: "added_models",
      comment: "first",
    });
    await handleShowcaseDistributionTaskComplete(pool, MANAGER, {
      dealerId: DEALER_ID,
      taskId,
      categoryId: "hardware",
      newActualCount: 7,
      resultKind: "photo_report",
      comment: "second",
    });
    const { state } = await handleShowcaseDistributionState(pool, MANAGER, DEALER_ID);
    expect(state.taskUpdates[taskId]?.resolvedActualCount).toBe(7);
    expect(state.overrides[`${DEALER_ID}|hardware`]?.actualCount).toBe(7);
    expect(pool.history.length).toBe(2);
  });

  it("denies analyst completing tasks", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    await expect(
      handleShowcaseDistributionTaskComplete(pool, ANALYST, {
        dealerId: DEALER_ID,
        taskId: `sd-${DEALER_ID}-molding`,
        categoryId: "molding",
        newActualCount: 2,
        resultKind: "added_models",
        comment: "",
      }),
    ).rejects.toBeInstanceOf(ShowcaseDistributionForbiddenError);
  });

  it("updates task status without history", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    const taskId = `sd-${DEALER_ID}-interior_doors`;
    const result = await handleShowcaseDistributionTaskStatus(pool, MANAGER, {
      dealerId: DEALER_ID,
      taskId,
      categoryId: "interior_doors",
      status: "in_progress",
    });
    expect(result.state.taskUpdates[taskId]?.status).toBe("in_progress");
    expect(pool.history.length).toBe(0);
  });

  it("returns conflict on duplicate recommendation", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    const payload = {
      dealerId: DEALER_ID,
      modelId: "model-x",
      modelLabel: "Model X",
      categoryId: "entrance_doors",
      bucket: "top20" as const,
      reason: "ТОП продаж",
    };
    const first = await handleShowcaseDistributionRecommendation(pool, MANAGER, payload);
    expect(first.success).toBe(true);
    const second = await handleShowcaseDistributionRecommendation(pool, MANAGER, payload);
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.conflict).toBe(true);
      expect(second.message).toContain("уже добавлена");
    }
  });

  it("allows admin override", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    const result = await handleShowcaseDistributionOverride(pool, ADMIN, {
      dealerId: DEALER_ID,
      categoryId: "molding",
      actualCount: 5,
      status: "ok",
      comment: "admin fix",
    });
    expect(result.state.overrides[`${DEALER_ID}|molding`]?.actualCount).toBe(5);
    expect(pool.history.length).toBe(1);
  });

  it("denies manager override", async () => {
    const pool = new InMemoryShowcaseDistributionDb();
    await expect(
      handleShowcaseDistributionOverride(pool, MANAGER, {
        dealerId: DEALER_ID,
        categoryId: "molding",
        actualCount: 5,
        status: "ok",
        comment: "",
      }),
    ).rejects.toBeInstanceOf(ShowcaseDistributionForbiddenError);
  });
});
