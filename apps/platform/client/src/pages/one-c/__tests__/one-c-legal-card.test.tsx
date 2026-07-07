/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OneCLegalCard } from "../one-c-legal-card";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCLegalListItem } from "@/lib/one-c-showroom-api";

vi.mock("../one-c-legal-distribution-summary", () => ({
  OneCLegalDistributionSummary: ({ testId, variant }: { testId: string; variant?: string }) => (
    <span data-testid={testId}>{variant === "full" ? "legal-dist-full" : "legal-dist-compact"}</span>
  ),
}));

const act = createEmptyActualizationState();

const row: OneCLegalListItem = {
  id_1c: "legal-1",
  name: "Ромашка",
  legal_name: "ООО Ромашка",
  inn: "7700000000",
  kpp: "770001001",
  city: "Москва",
  parent_1c: "parent-1",
  parent_name: "Холдинг А",
  client_type: "ТОП 350",
  payment_form: "Безналичные",
  regional_manager_name: "Петров",
  responsible_manager_name: "Иванов",
  plan_sum: 1000000,
  stores_count: 3,
  has_distribution: true,
};

afterEach(() => {
  cleanup();
});

describe("OneCLegalCard", () => {
  it("renders grid density", () => {
    render(<OneCLegalCard row={row} density="grid" act={act} />);

    expect(screen.getByTestId("card-one-c-legal-legal-1").getAttribute("data-density")).toBe("grid");
    expect(screen.getByText("3 ТТ")).toBeTruthy();
    expect(screen.getByTestId("one-c-legal-tile-dist-legal-1").textContent).toContain("legal-dist-compact");
  });

  it("renders large density with full distribution summary", () => {
    render(<OneCLegalCard row={row} density="large" act={act} />);

    expect(screen.getByTestId("card-one-c-legal-legal-1").getAttribute("data-density")).toBe("large");
    expect(screen.getByTestId("one-c-legal-large-dist-legal-1").textContent).toContain("legal-dist-full");
  });

  it("renders list density", () => {
    render(<OneCLegalCard row={row} density="list" act={act} />);

    expect(screen.getByTestId("card-one-c-legal-legal-1").getAttribute("data-density")).toBe("list");
    expect(screen.getByTestId("one-c-legal-list-dist-legal-1").textContent).toContain("legal-dist-compact");
  });
});
