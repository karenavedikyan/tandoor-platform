/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminAuditPage from "@/pages/admin-audit";
import { useCurrentUser } from "@/hooks/use-current-user";

const ADMIN_ID = "d43940b0-f52f-413e-8de6-7d62d5dcc8b5";

const sampleRow = {
  id: "row-1",
  occurredAt: "2026-06-10T12:00:00.000Z",
  actorUserId: ADMIN_ID,
  actorFullName: "Карен",
  actorEmail: "karen@test.local",
  actorRole: "admin",
  action: "auth.login",
  entityType: "session",
  entityId: "sess-1",
  summary: "auth.login · session · sess-1",
  details: { ip: "127.0.0.1" },
};

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock("@/components/navigation/back-nav", () => ({
  BackNav: () => <div data-testid="back-nav" />,
}));

vi.mock("@/lib/admin-users-api", () => ({
  listUsers: vi.fn(async () => ({
    users: [
      {
        id: ADMIN_ID,
        email: "karen@test.local",
        fullName: "Карен",
        role: "admin",
        status: "active",
        mustChangePassword: false,
        lastLoginAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        telegramUserId: null,
      },
    ],
    total: 1,
  })),
}));

const listAdminAudit = vi.fn();

vi.mock("@/lib/admin-audit-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-audit-api")>();
  return {
    ...actual,
    listAdminAudit: (...args: unknown[]) => listAdminAudit(...args),
  };
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminAuditPage />
    </QueryClientProvider>,
  );
}

describe("AdminAuditPage", () => {
  beforeEach(() => {
    window.location.hash = "#/admin/audit?source=general";
    vi.mocked(useCurrentUser).mockReturnValue({
      user: {
        id: ADMIN_ID,
        role: "admin",
        email: "karen@test.local",
        fullName: "Карен",
      },
    } as ReturnType<typeof useCurrentUser>);
    listAdminAudit.mockResolvedValue({
      source: "general",
      rows: [sampleRow],
      total: 1,
      limit: 50,
      offset: 0,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders audit table rows", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("row-audit-row-1")).toBeTruthy();
    });
    expect(screen.getByText("auth.login · session · sess-1")).toBeTruthy();
  });

  it("switches source tab", async () => {
    renderPage();
    await waitFor(() => expect(listAdminAudit).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("tab-audit-source-client_assignments"));
    await waitFor(() => {
      expect(listAdminAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: "client_assignments" }),
      );
    });
  });

  it("applies action filter", async () => {
    renderPage();
    await waitFor(() => expect(listAdminAudit).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId("input-audit-filter-action"), { target: { value: "auth.login" } });
    fireEvent.click(screen.getByTestId("button-audit-apply"));
    await waitFor(() => {
      expect(listAdminAudit).toHaveBeenLastCalledWith(expect.objectContaining({ action: "auth.login" }));
    });
  });

  it("opens details sheet on row click", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("row-audit-row-1")).toBeTruthy());
    fireEvent.click(screen.getByTestId("row-audit-row-1"));
    await waitFor(() => {
      expect(screen.getByTestId("sheet-audit-details")).toBeTruthy();
      expect(screen.getByText(/127\.0\.0\.1/)).toBeTruthy();
    });
  });

  it("shows forbidden for regional_manager", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      user: {
        id: "bb0e6231-8c1e-46ae-9e0f-a1d9003d9b81",
        role: "regional_manager",
        email: "rm@test.local",
        fullName: "Серебряков",
      },
    } as ReturnType<typeof useCurrentUser>);
    renderPage();
    expect(screen.getByText(/Недостаточно прав/)).toBeTruthy();
    expect(screen.queryByTestId("row-audit-row-1")).toBeNull();
  });
});
