import { describe, expect, it } from "vitest";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";

describe("Промт 354: mapUserRoleToDealerBaseAccess", () => {
  it("regional_manager → sales_manager (личный scope, без команды)", () => {
    expect(mapUserRoleToDealerBaseAccess("regional_manager")).toBe("sales_manager");
  });

  it("rop → team_lead", () => {
    expect(mapUserRoleToDealerBaseAccess("rop")).toBe("team_lead");
  });

  it("manager → sales_manager", () => {
    expect(mapUserRoleToDealerBaseAccess("manager")).toBe("sales_manager");
  });

  it("director → sales_director", () => {
    expect(mapUserRoleToDealerBaseAccess("director")).toBe("sales_director");
  });
});
