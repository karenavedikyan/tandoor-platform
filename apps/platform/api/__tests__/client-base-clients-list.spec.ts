import { describe, expect, it } from "vitest";
import {
  countClientsByListStatus,
  mergeClientBaseClientsList,
  type ClientBaseActualizationClient,
  type ClientBaseCatalogDealerMeta,
} from "../../shared/client-base-clients-list-merge.js";

describe("client-base-clients-list merge invariants", () => {
  it("no_status equals catalog minus active minus potential", () => {
    const catalogKeys = new Set(["a", "b", "c"]);
    const catalogMeta = new Map<string, ClientBaseCatalogDealerMeta>(
      ["a", "b", "c"].map((k) => [
        k,
        {
          externalKey: k,
          fullName: k,
          city: null,
          managerUserId: null,
          managerFullName: null,
          inn: null,
          phone: null,
          legalEntity: false,
          tradePointIds: [],
          tradePointsCount: 0,
          hasManager: false,
          hasRegional: false,
          hasRop: false,
        },
      ]),
    );
    const actualizationClients: ClientBaseActualizationClient[] = [
      {
        id: "a",
        fullName: "A",
        city: null,
        managerUserId: null,
        managerFullName: null,
        inn: null,
        phone: null,
        legalEntity: false,
        normalizedStatus: "active",
        updatedAt: null,
        tradePointIds: [],
      },
      {
        id: "p-only",
        fullName: "P",
        city: null,
        managerUserId: null,
        managerFullName: null,
        inn: null,
        phone: null,
        legalEntity: false,
        normalizedStatus: "potential",
        updatedAt: null,
        tradePointIds: [],
      },
    ];
    const clients = mergeClientBaseClientsList({
      catalogKeys,
      catalogMeta,
      actualizationClients,
      staleCutoffMs: Date.now(),
    });
    const counts = countClientsByListStatus(clients);
    expect(counts.all).toBe(3);
    expect(counts.active).toBe(1);
    expect(counts.potential).toBe(1);
    expect(counts.noStatus).toBe(2);
    expect(counts.active + counts.potential + counts.noStatus).toBe(counts.all + 1);
  });
});
