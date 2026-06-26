/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { DealerRopRmSelectors } from "../dealer-rop-rm-selectors";
import type { PickerUser } from "@/lib/users-picker-api";

const listRopPickerUsersMock = vi.hoisted(() =>
  vi.fn<() => Promise<PickerUser[]>>(async () => []),
);
const listRegionalManagerPickerUsersMock = vi.hoisted(() =>
  vi.fn<() => Promise<PickerUser[]>>(async () => []),
);

vi.mock("@/lib/users-picker-api", () => ({
  listRopPickerUsers: listRopPickerUsersMock,
  listRegionalManagerPickerUsers: listRegionalManagerPickerUsersMock,
  pickerUserById: vi.fn(),
}));

const noop = vi.fn();

afterEach(() => {
  cleanup();
  listRopPickerUsersMock.mockClear();
  listRegionalManagerPickerUsersMock.mockClear();
});

describe("DealerRopRmSelectors", () => {
  it("renders read-only names without picker requests when readOnly is true", async () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <DealerRopRmSelectors
        ropUserId="rop-1"
        regionalManagerUserId="rm-1"
        readOnly
        ropDisplayName="Сапожков Артем"
        regionalManagerDisplayName="Богачёв Денис"
        onRopChange={noop}
        onRegionalManagerChange={noop}
        ropTestId="select-dealer-rop"
        rmTestId="select-dealer-regional-manager"
      />,
    );

    expect(getByText("Сапожков Артем")).toBeTruthy();
    expect(getByText("Богачёв Денис")).toBeTruthy();
    expect(getByTestId("select-dealer-rop-readonly")).toBeTruthy();
    expect(getByTestId("select-dealer-regional-manager-readonly")).toBeTruthy();
    expect(queryByTestId("select-dealer-rop")).toBeNull();
    expect(queryByTestId("select-dealer-regional-manager")).toBeNull();

    await waitFor(() => {
      expect(listRopPickerUsersMock).not.toHaveBeenCalled();
      expect(listRegionalManagerPickerUsersMock).not.toHaveBeenCalled();
    });
  });

  it("shows not assigned label in read-only mode when names are empty", () => {
    const { getAllByText } = render(
      <DealerRopRmSelectors
        ropUserId={null}
        regionalManagerUserId={null}
        readOnly
        ropDisplayName={null}
        regionalManagerDisplayName=""
        onRopChange={noop}
        onRegionalManagerChange={noop}
      />,
    );

    expect(getAllByText("— не назначено —")).toHaveLength(2);
  });

  it("renders editable selects and loads picker lists when readOnly is false", async () => {
    listRopPickerUsersMock.mockResolvedValue([
      { id: "rop-1", full_name: "РОП Тест", role: "rop", status: "active" } satisfies PickerUser,
    ]);
    listRegionalManagerPickerUsersMock.mockResolvedValue([
      { id: "rm-1", full_name: "РМ Тест", role: "regional_manager", status: "active" } satisfies PickerUser,
    ]);

    const { getByTestId } = render(
      <DealerRopRmSelectors
        ropUserId={null}
        regionalManagerUserId={null}
        onRopChange={noop}
        onRegionalManagerChange={noop}
      />,
    );

    expect(getByTestId("select-dealer-rop")).toBeTruthy();
    expect(getByTestId("select-dealer-regional-manager")).toBeTruthy();

    await waitFor(() => {
      expect(listRopPickerUsersMock).toHaveBeenCalledTimes(1);
      expect(listRegionalManagerPickerUsersMock).toHaveBeenCalledTimes(1);
    });
  });
});
