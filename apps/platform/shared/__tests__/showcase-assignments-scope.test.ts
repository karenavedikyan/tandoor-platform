/**
 * Запуск: `npm run test:showcase-assignments-scope` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  AssignmentValidationError,
  handleGet,
  handleItemToggle,
  handleList,
  handleSubmit,
  type AssignmentSessionUser,
} from "../showcase-assignments-handlers.js";

type PoolLike = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

const MGR = "11111111-1111-1111-1111-111111111111";
const ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ASG_OWN = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001";
const ASG_FOREIGN = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002";
const DEALER_OWN = "client-MA001";
const DEALER_FOREIGN = "client-MA999";
const TP = "client-MA001-01";

function activeUser(id: string, role: string): AssignmentSessionUser {
  return { id, role, status: "active", fullName: "Test User" };
}

function assignmentRow(id: string, dealerId: string, assigneeUserId: string | null = MGR) {
  return {
    id,
    dealer_id: dealerId,
    trade_point_id: TP,
    status: "open",
    title: "Test",
    comment: null,
    due_date: null,
    shipped_date: null,
    created_by: ADMIN,
    created_by_name: "Admin",
    assignee_user_id: assigneeUserId,
    assignee_name: "Manager",
    submitted_at: null,
    verified_at: null,
    verified_by: null,
    verified_by_name: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    is_archived: false,
    archived_at: null,
  };
}

type MockRule = {
  match: (sql: string, params?: unknown[]) => boolean;
  rows: Record<string, unknown>[];
};

function mockPool(rules: MockRule[]): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      for (const rule of rules) {
        if (rule.match(s, params)) return { rows: rule.rows };
      }
      if (s.includes("FROM showcase_install_assignment_items")) return { rows: [] };
      if (s.includes("FROM client_assignments") && s.includes("responsible_user_id")) {
        return { rows: [] };
      }
      throw new Error(`unexpected sql: ${s}`);
    },
  };
}

function managerPoolOwnCodes(codes: string[]): PoolLike {
  return mockPool([
    {
      match: (s) => s.includes("FROM showcase_install_assignments") && s.includes("ORDER BY created_at"),
      rows: [assignmentRow(ASG_OWN, DEALER_OWN), assignmentRow(ASG_FOREIGN, DEALER_FOREIGN)],
    },
    {
      match: (s, params) =>
        s.includes("FROM showcase_install_assignments") &&
        s.includes("WHERE id = $1") &&
        String(params?.[0]) === ASG_OWN,
      rows: [assignmentRow(ASG_OWN, DEALER_OWN)],
    },
    {
      match: (s, params) =>
        s.includes("FROM showcase_install_assignments") &&
        s.includes("WHERE id = $1") &&
        String(params?.[0]) === ASG_FOREIGN,
      rows: [assignmentRow(ASG_FOREIGN, DEALER_FOREIGN)],
    },
    {
      match: (s) => s.includes("FROM client_assignments") && s.includes("responsible_user_id"),
      rows: codes.map((client_code) => ({ client_code })),
    },
  ]);
}

// handleList
{
  const pool = mockPool([
    {
      match: (s) => s.includes("FROM showcase_install_assignments") && s.includes("ORDER BY created_at"),
      rows: [assignmentRow(ASG_OWN, DEALER_OWN), assignmentRow(ASG_FOREIGN, DEALER_FOREIGN)],
    },
  ]);
  const { assignments } = await handleList(pool, activeUser(ADMIN, "admin"), {});
  assert.equal(assignments.length, 2);
  console.log("assignments list: admin sees all");
}

{
  const pool = managerPoolOwnCodes([]);
  const { assignments } = await handleList(pool, activeUser(MGR, "manager"), { mine: false });
  assert.equal(assignments.length, 0);
  console.log("assignments list: manager empty codes");
}

{
  const pool = managerPoolOwnCodes(["MA001"]);
  const { assignments } = await handleList(pool, activeUser(MGR, "manager"), { mine: false });
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0]!.dealerId, DEALER_OWN);
  console.log("assignments list: manager MA001 only");
}

// handleGet
{
  const pool = managerPoolOwnCodes(["MA001"]);
  let err: AssignmentValidationError | null = null;
  try {
    await handleGet(pool, activeUser(MGR, "manager"), ASG_FOREIGN);
  } catch (e) {
    err = e as AssignmentValidationError;
  }
  assert.ok(err instanceof AssignmentValidationError);
  assert.equal(err.code, "FORBIDDEN");
  console.log("assignments get: foreign FORBIDDEN");
}

{
  const pool = managerPoolOwnCodes(["MA001"]);
  const { assignment } = await handleGet(pool, activeUser(MGR, "manager"), ASG_OWN);
  assert.equal(assignment.id, ASG_OWN);
  console.log("assignments get: own assignment");
}

// handleItemToggle / handleSubmit
{
  const pool = managerPoolOwnCodes(["MA001"]);
  let err: AssignmentValidationError | null = null;
  try {
    await handleItemToggle(pool, activeUser(MGR, "manager"), {
      assignmentId: ASG_FOREIGN,
      itemId: "item-1",
      done: true,
    });
  } catch (e) {
    err = e as AssignmentValidationError;
  }
  assert.ok(err instanceof AssignmentValidationError);
  assert.equal(err.code, "FORBIDDEN");
  console.log("assignments item-toggle: foreign FORBIDDEN");
}

{
  const pool = managerPoolOwnCodes(["MA001"]);
  let err: AssignmentValidationError | null = null;
  try {
    await handleSubmit(pool, activeUser(MGR, "manager"), { assignmentId: ASG_FOREIGN });
  } catch (e) {
    err = e as AssignmentValidationError;
  }
  assert.ok(err instanceof AssignmentValidationError);
  assert.equal(err.code, "FORBIDDEN");
  console.log("assignments submit: foreign FORBIDDEN");
}

console.log("showcase-assignments-scope: ok");
