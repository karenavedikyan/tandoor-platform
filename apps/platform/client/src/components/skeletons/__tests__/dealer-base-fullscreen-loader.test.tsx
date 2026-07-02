/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DealerBaseFullscreenLoader } from "../dealer-base-fullscreen-loader";

afterEach(() => {
  cleanup();
});

describe("DealerBaseFullscreenLoader", () => {
  it("renders brand loader with page caption", () => {
    const { getByTestId, getByText } = render(<DealerBaseFullscreenLoader />);
    expect(getByTestId("dealer-base-fullscreen-loader")).toBeTruthy();
    expect(getByTestId("section-dealer-base-page-distribution-loading")).toBeTruthy();
    expect(getByText("Готовим точную информацию по команде")).toBeTruthy();
  });

  it("shows director progress when provided", () => {
    const { getByTestId } = render(
      <DealerBaseFullscreenLoader
        progress={{ loadedBuckets: 2, totalBuckets: 5, prefetching: true }}
      />,
    );
    expect(getByTestId("brand-distribution-loader-rop-progress")).toBeTruthy();
  });
});
