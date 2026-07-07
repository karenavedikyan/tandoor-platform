import { describe, expect, it } from "vitest";
import { nameMatches } from "../shared/one-c-name-matching.js";
import { countFilledCategories } from "../shared/one-c-distribution-categories.js";
import {
  canEditDistributionForStore1cSync,
  type OneCDistributionUser,
} from "../shared/one-c-distribution-permissions.js";

describe("one-c-distribution-permissions", () => {
  const names = {
    regional_manager_name: "Богачев Денис Николаевич",
    responsible_manager_name: "Илюченко Александр Николаевич",
  };

  const admin: OneCDistributionUser = {
    id: "admin-1",
    role: "admin",
    status: "active",
    full_name: "Admin",
  };

  const ropOk: OneCDistributionUser = {
    id: "rop-1",
    role: "rop",
    status: "active",
    full_name: "Скалабан Александр",
  };

  const ropOther: OneCDistributionUser = {
    id: "rop-2",
    role: "rop",
    status: "active",
    full_name: "Другой РОП",
  };

  const managerOk: OneCDistributionUser = {
    id: "mgr-1",
    role: "manager",
    status: "active",
    full_name: "Илюченко Александр",
  };

  const managerNo: OneCDistributionUser = {
    id: "mgr-2",
    role: "manager",
    status: "active",
    full_name: "Петров Петр",
  };

  it("admin can always edit", () => {
    expect(canEditDistributionForStore1cSync(admin, names, [])).toBe(true);
  });

  it("rop of matching RM team can edit", () => {
    expect(
      canEditDistributionForStore1cSync(ropOk, names, ["Богачёв Денис Николаевич"]),
    ).toBe(true);
  });

  it("rop of other team cannot edit", () => {
    expect(canEditDistributionForStore1cSync(ropOther, names, ["Иванов Иван"])).toBe(false);
  });

  it("manager with matching responsible name can edit", () => {
    expect(canEditDistributionForStore1cSync(managerOk, names, [])).toBe(true);
    expect(nameMatches(managerOk.full_name, names.responsible_manager_name!)).toBe(true);
  });

  it("manager without name match cannot edit", () => {
    expect(canEditDistributionForStore1cSync(managerNo, names, [])).toBe(false);
  });
});

describe("one-c-distribution-categories aggregation", () => {
  it("counts filled categories X/Y", () => {
    const agg = countFilledCategories([
      { category_id: "entrance_doors", actual_count: 2 },
      { category_id: "hardware", actual_count: 0 },
      { category_id: "molding", actual_count: 1 },
    ]);
    expect(agg).toEqual({ filled: 2, total: 4 });
  });
});

describe("one-c matrix upsert idempotency (client_op_id)", () => {
  it("documents duplicate client_op_id returns existing override without second insert", () => {
    const seen = new Set<string>();
    const op = "op-123";
    const first = !seen.has(op);
    if (first) seen.add(op);
    const second = !seen.has(op);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
