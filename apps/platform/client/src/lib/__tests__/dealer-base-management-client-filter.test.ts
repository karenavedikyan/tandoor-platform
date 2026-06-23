import { describe, expect, it } from "vitest";
import { dealerMatchesClientListFilter } from "@/lib/dealer-base-management-view-model";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

function row(status: DealerRow["status"], outlets = 1): DealerRow {
  return { status, outlets } as unknown as DealerRow;
}

describe("dealerMatchesClientListFilter no_status", () => {
  it("включает приостановленных и требующих внимания", () => {
    expect(dealerMatchesClientListFilter(row("приостановлен"), "no_status")).toBe(true);
    expect(dealerMatchesClientListFilter(row("требует внимания"), "no_status")).toBe(true);
  });

  it("исключает активных и потенциальных", () => {
    expect(dealerMatchesClientListFilter(row("активный"), "no_status")).toBe(false);
    expect(dealerMatchesClientListFilter(row("потенциальный"), "no_status")).toBe(false);
  });
});
