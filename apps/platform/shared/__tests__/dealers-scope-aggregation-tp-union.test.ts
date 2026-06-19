/**
 * Промт 423b: active_trade_points — SET-union по tp_id, не сумма member.totals (RM дубли).
 * Запуск: npm run test:dealers-scope-aggregation-tp-union
 */
import assert from "node:assert/strict";
import {
  aggregateMemberTotals,
  aggregateOrgTotals,
  unionTradePointIds,
} from "../dealers-scope-aggregation.js";
import type { TeamScopeMember } from "../dealers-scope-types.js";

function tp(id: string) {
  return { tp_id: id, dealer_id: "client-x", is_primary: false };
}

const m1: TeamScopeMember = {
  user: { id: "m1", name: "M1", email: "", role: "manager" },
  totals: { active_dealers: 3, active_trade_points: 3, trashed_dealers: 0, trashed_trade_points: 0 },
  active_dealer_external_keys: ["c1", "c2", "c3"],
  trashed_dealer_external_keys: [],
  active_trade_points: [tp("tp1"), tp("tp2"), tp("tp3")],
};

const m2: TeamScopeMember = {
  user: { id: "m2", name: "M2", email: "", role: "manager" },
  totals: { active_dealers: 2, active_trade_points: 2, trashed_dealers: 0, trashed_trade_points: 0 },
  active_dealer_external_keys: ["c4", "c5"],
  trashed_dealer_external_keys: [],
  active_trade_points: [tp("tp4"), tp("tp5")],
};

const rm: TeamScopeMember = {
  user: { id: "rm1", name: "RM", email: "", role: "regional_manager" },
  totals: { active_dealers: 5, active_trade_points: 5, trashed_dealers: 0, trashed_trade_points: 0 },
  active_dealer_external_keys: ["c1", "c2", "c3", "c4", "c5"],
  trashed_dealer_external_keys: [],
  active_trade_points: [tp("tp1"), tp("tp2"), tp("tp3"), tp("tp4"), tp("tp5")],
};

const members = [m1, m2, rm];

assert.equal(unionTradePointIds(members).size, 5);

const teamTotals = aggregateMemberTotals(members);
assert.equal(teamTotals.active_trade_points, 5, "team: 5 unique tp_id, not 3+2+5=10");
assert.notEqual(teamTotals.active_trade_points, 13);

const orphanEmpty: TeamScopeMember["totals"] = {
  active_dealers: 0,
  active_trade_points: 0,
  trashed_dealers: 0,
  trashed_trade_points: 0,
};

const orgTotals = aggregateOrgTotals([teamTotals], orphanEmpty, members);
assert.equal(orgTotals.active_trade_points, 5, "org: union over allMembers");

console.log("dealers-scope-aggregation-tp-union.test.ts OK");
