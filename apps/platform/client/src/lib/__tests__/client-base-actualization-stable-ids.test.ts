import assert from "node:assert/strict";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import {
  findDealerCandidatesByName,
  findExactNameDuplicateInActualization,
  normalizeDealerNameForMatch,
} from "../client-base-actualization-stable-ids";

function row(id: string, name: string, managerId: string, city = "Макеевка", code = "MA-TEST"): DealerRow {
  return {
    id,
    name,
    city,
    releaseManagerId: managerId,
    releaseCode: code,
    manager: managerId === "mgr-a" ? "Менеджер А" : "Менеджер Б",
  } as unknown as DealerRow;
}

assert.equal(
  normalizeDealerNameForMatch("Бабич Элла Юрьевна ИП"),
  normalizeDealerNameForMatch("Бабич, Элла  Юрьевна  (ИП)"),
);

{
  const rows = [
    row("r-sub", "ООО Ромашка Бабич", "mgr-a", "Донецк", "MA-SUB"),
    row("r-prefix", "Бабич Элла Юрьевна ИП", "mgr-a", "Макеевка", "MA-PREFIX"),
    row("r-other", "Бабич Элла Юрьевна ИП", "mgr-b", "Макеевка", "MA-OTHER"),
    row("r-extra", "Бабичев Иван ИП", "mgr-a", "Донецк", "MA-EXTRA"),
  ];
  const c = findDealerCandidatesByName({
    nameQuery: "Бабич",
    mergedRows: rows,
    managerUserId: "mgr-a",
    limit: 2,
  });
  assert.deepEqual(
    c.map((x) => x.dealerId),
    ["r-prefix", "r-extra"],
  );
  assert.equal(c.every((x) => x.managerName === "Менеджер А"), true);
}

{
  const state = createEmptyActualizationState();
  const duplicate = findExactNameDuplicateInActualization(
    "Бабич, Элла Юрьевна (ИП)",
    [row("release-babich", "Бабич Элла Юрьевна ИП", "mgr-a"), row("other-manager", "Бабич Элла Юрьевна ИП", "mgr-b")],
    state,
    "mgr-a",
  );
  assert.equal(duplicate?.dealerId, "release-babich");
}

console.log("client-base-actualization-stable-ids: ok");
