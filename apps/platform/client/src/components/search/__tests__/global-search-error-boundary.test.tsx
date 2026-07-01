/**
 * @vitest-environment jsdom
 *
 * Error Boundary в глобальном поиске: ошибка внутри панели не роняет родителя.
 * Запуск: `npm run test:global-search-scope` из каталога apps/platform.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { DealerBaseErrorBoundary } from "@/components/dealer-base-error-boundary";

function Boom(): ReactElement {
  throw new Error("search render failed");
}

function SearchErrorFallback(): ReactElement {
  return (
    <div data-testid="global-search-error-fallback">Поиск временно недоступен</div>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("global search error boundary", () => {
  it("shows fallback inside search panel without crashing parent", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <div data-testid="app-shell-survives">
        <DealerBaseErrorBoundary renderError={() => <SearchErrorFallback />}>
          <Boom />
        </DealerBaseErrorBoundary>
      </div>,
    );

    expect(screen.getByTestId("app-shell-survives")).toBeTruthy();
    expect(screen.getByTestId("global-search-error-fallback").textContent).toContain("Поиск временно недоступен");
    consoleError.mockRestore();
  });
});
