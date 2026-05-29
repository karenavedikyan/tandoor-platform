/**
 * Проверки видимости и группировки для ImpersonationQuickSwitch (promt 103).
 */
import assert from "node:assert/strict";
import {
  canShowImpersonationQuickSwitch,
  filterImpersonationTargets,
  groupImpersonationTargets,
} from "../../components/layout/impersonation-quick-switch-utils";
import type { ImpersonationTarget } from "../use-impersonation-targets";

function testVisibility() {
  assert.equal(canShowImpersonationQuickSwitch("admin"), true);
  assert.equal(canShowImpersonationQuickSwitch("director"), false);
  assert.equal(canShowImpersonationQuickSwitch("manager"), false);
  assert.equal(canShowImpersonationQuickSwitch(null), false);
}

function testFilterAndGroup() {
  const targets: ImpersonationTarget[] = [
    { id: "1", fullName: "Иван Петров", email: "ivan@tandoor.ru", role: "manager" },
    { id: "2", fullName: "Анна Директор", email: "anna@tandoor.ru", role: "director" },
    { id: "3", fullName: "РОП Тест", email: "rop@tandoor.ru", role: "rop" },
  ];
  const filtered = filterImpersonationTargets(targets, "иван");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "1");

  const groups = groupImpersonationTargets(targets);
  assert.equal(groups.length, 3);
  assert.equal(groups.find((g) => g.key === "managers")?.users.length, 1);
  assert.equal(groups.find((g) => g.key === "director")?.users.length, 1);
}

testVisibility();
testFilterAndGroup();
console.log("impersonation-quick-switch.test.ts: ok");
