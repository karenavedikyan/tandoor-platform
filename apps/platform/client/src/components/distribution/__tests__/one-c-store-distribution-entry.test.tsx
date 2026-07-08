/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OneCStoreDetailWithDistribution } from "@/lib/one-c-showroom-api";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { SHOWCASE_MATRIX_CHANGED_EVENT } from "@/lib/trade-point-showcase-matrix-storage";

const triggerExportMock = vi.fn();

vi.mock("@/lib/one-c-distribution-export", () => ({
  triggerDistributionExportTo1cFireAndForget: (cb?: (r: { ok: boolean; message: string }) => void) => {
    triggerExportMock();
    cb?.({ ok: true, message: "Отправлено в 1С" });
  },
}));

vi.mock("@/components/distribution/distribution-tradepoint-matrix-entry", () => ({
  DistributionTradePointMatrixEntry: () => (
    <div data-testid="mock-matrix-entry">
      <button type="button" data-testid="button-save-distribution-mock">
        Сохранить
      </button>
    </div>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { OneCStoreDistributionEntry } from "@/components/distribution/one-c-store-distribution-entry";

const profile: ReleaseDemoProfile = { role: "sales_manager", personaUserId: "mgr-1" };

const store: OneCStoreDetailWithDistribution = {
  id_1c: "store-uuid-1",
  address: "ул. Тестовая, 1",
  name: "ТТ 1",
  status: "active",
  imported_at: "2026-07-01T00:00:00.000Z",
  manager_1c: null,
  manager_name: "Иванов",
  manager_phone: null,
  legal_entity_1c: "legal-uuid-1",
  legal_name: "ООО Тест",
  legal_legal_name: "ООО Тест полное",
  legal_inn: "7700000000",
  legal_kpp: null,
  legal_ogrn: null,
  legal_region: "Москва",
  legal_city: "Москва",
  legal_client_type: "ТОП 350",
  legal_payment_form: "Безнал",
  legal_phone: null,
  legal_email: null,
  legal_discount_code: null,
  legal_discount_percent: null,
  legal_responsible_manager_name: "Иванов",
  legal_regional_manager_name: "Петров",
  legal_plan_sum: null,
  legal_plan_retro_bonus: null,
  responsible_manager_user_id: null,
  regional_manager_user_id: null,
  rop_user_id: null,
  rop_name: null,
  matrix: [],
  overrides: [],
  history: [],
  distributionFill: { filled: 0, total: 4 },
  canEditDistribution: true,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OneCStoreDistributionEntry", () => {
  it("renders distribution form shell", () => {
    render(
      <OneCStoreDistributionEntry
        storeId1c="store-uuid-1"
        store={store}
        profile={profile}
        actorUserId="user-1"
        actorName="Тест"
      />,
    );
    expect(screen.getByTestId("one-c-store-distribution-entry")).toBeTruthy();
    expect(screen.getByTestId("mock-matrix-entry")).toBeTruthy();
  });

  it("triggers export after matrix change event", async () => {
    render(
      <OneCStoreDistributionEntry
        storeId1c="store-uuid-1"
        store={store}
        profile={profile}
        actorUserId="user-1"
        actorName="Тест"
      />,
    );

    fireEvent.click(screen.getByTestId("button-save-distribution-mock"));
    window.dispatchEvent(new CustomEvent(SHOWCASE_MATRIX_CHANGED_EVENT));

    await waitFor(
      () => {
        expect(triggerExportMock).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
  });
});
