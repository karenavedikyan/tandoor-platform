/**
 * Промт 420/421: dealer-base trash via API; no client archive UI.
 * Запуск: `npm run test:dealer-base-trash-via-api` из apps/platform.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const dealerBaseSource = readFileSync(join(here, "../pages/dealer-base.tsx"), "utf8");

describe("dealer-base trash via API (420)", () => {
  it("handleRowTrashDealer calls trashDealerStrict, not actx.persist trashedDealersById", () => {
    const trashHandler = dealerBaseSource.slice(
      dealerBaseSource.indexOf("const handleRowTrashDealer"),
      dealerBaseSource.indexOf("const dealerRowQuickMoveProps"),
    );
    expect(trashHandler).toContain("trashDealerStrict");
    expect(trashHandler).toContain("refreshDealerTrashFromServer");
    expect(trashHandler).not.toContain("trashedDealersById");
    expect(trashHandler).not.toContain("actx.persist");
  });

  it("confirmBulkTrashDealers calls bulkTrashDealersStrict", () => {
    const bulkHandler = dealerBaseSource.slice(
      dealerBaseSource.indexOf("const confirmBulkTrashDealers"),
      dealerBaseSource.indexOf("const selectedWpRows"),
    );
    expect(bulkHandler).toContain("bulkTrashDealersStrict");
    expect(bulkHandler).not.toContain("trashedDealersById");
    expect(bulkHandler).not.toContain("actx.persist");
  });

  it("trashableDealerIdsInView uses isDealerTrashedInRuntime not jsonb trashedDealersById", () => {
    const block = dealerBaseSource.slice(
      dealerBaseSource.indexOf("const trashableDealerIdsInView"),
      dealerBaseSource.indexOf("useEffect(() => {\n    setSelectedBulkTrashDealerIds"),
    );
    expect(block).toContain("isDealerTrashedInRuntime");
    expect(block).not.toContain("trashedDealersById");
  });
});

describe("dealer-base has no client archive UI (421)", () => {
  it("does not render archive toggle or bulk soft-archive controls", () => {
    expect(dealerBaseSource).not.toContain("showArchivedDealers");
    expect(dealerBaseSource).not.toContain("toggle-dealers-show-archived");
    expect(dealerBaseSource).not.toContain("section-dealers-archived-toggle");
    expect(dealerBaseSource).not.toContain("Режим архива клиентов");
    expect(dealerBaseSource).not.toContain("button-dealer-bulk-soft-archive");
    expect(dealerBaseSource).not.toContain("archivedDealersById");
    expect(dealerBaseSource).not.toContain("archive-record-visual");
  });
});
