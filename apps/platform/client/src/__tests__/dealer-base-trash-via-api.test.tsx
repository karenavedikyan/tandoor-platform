/**
 * Промт 420: dealer-base пишет trash через API, не в jsonb.
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

  it("confirmBulkArchiveDealers calls bulkTrashDealersStrict", () => {
    const bulkHandler = dealerBaseSource.slice(
      dealerBaseSource.indexOf("const confirmBulkArchiveDealers"),
      dealerBaseSource.indexOf("const selectedWpRows"),
    );
    expect(bulkHandler).toContain("bulkTrashDealersStrict");
    expect(bulkHandler).not.toContain("trashedDealersById");
    expect(bulkHandler).not.toContain("actx.persist");
  });

  it("archivableDealerIdsInView uses isDealerTrashedInRuntime not jsonb trashedDealersById", () => {
    const block = dealerBaseSource.slice(
      dealerBaseSource.indexOf("const archivableDealerIdsInView"),
      dealerBaseSource.indexOf("useEffect(() => {\n    setSelectedBulkArchiveDealerIds"),
    );
    expect(block).toContain("isDealerTrashedInRuntime");
    expect(block).not.toContain("trashedDealersById");
  });
});
