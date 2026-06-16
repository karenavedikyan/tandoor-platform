/**
 * Запуск: `npm run test:distribution-empty-data-notice` из каталога apps/platform.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DistributionEmptyDataNotice } from "../distribution-empty-data-notice";

function renderNotice(props: { hasAnyEligible: boolean; totalRowsInScope: number }): string {
  return renderToStaticMarkup(createElement(DistributionEmptyDataNotice, props));
}

describe("DistributionEmptyDataNotice", () => {
  it("renders nothing when no rows in scope", () => {
    expect(renderNotice({ hasAnyEligible: false, totalRowsInScope: 0 })).toBe("");
  });

  it("renders nothing when there is at least one eligible TT", () => {
    expect(renderNotice({ hasAnyEligible: true, totalRowsInScope: 100 })).toBe("");
  });

  it("renders warning when rows in scope but none eligible", () => {
    const html = renderNotice({ hasAnyEligible: false, totalRowsInScope: 2439 });
    expect(html).toContain('data-testid="distribution-empty-data-notice"');
    expect(html).toContain("2439");
    expect(html).toContain("Дистрибуция не рассчитана");
  });
});
