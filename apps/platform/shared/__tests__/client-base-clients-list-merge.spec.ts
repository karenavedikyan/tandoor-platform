import { describe, expect, it } from "vitest";
import {
  countClientsByListStatus,
  mergeClientBaseClientsList,
  resolveClientExternalKey,
  type ClientBaseActualizationClient,
  type ClientBaseCatalogDealerMeta,
} from "../client-base-clients-list-merge.js";

describe("client-base-clients-list merge", () => {
  const catalogKeys = new Set(["dealer-a", "dealer-b", "dealer-c"]);
  const catalogMeta = new Map<string, ClientBaseCatalogDealerMeta>([
    [
      "dealer-a",
      {
        externalKey: "dealer-a",
        fullName: "A",
        city: "Москва",
        managerUserId: null,
        managerFullName: null,
        inn: null,
        phone: null,
        legalEntity: false,
        tradePointIds: [],
        tradePointsCount: 0,
      },
    ],
    [
      "dealer-b",
      {
        externalKey: "dealer-b",
        fullName: "B",
        city: null,
        managerUserId: null,
        managerFullName: null,
        inn: null,
        phone: null,
        legalEntity: false,
        tradePointIds: [],
        tradePointsCount: 0,
      },
    ],
    [
      "dealer-c",
      {
        externalKey: "dealer-c",
        fullName: "C",
        city: null,
        managerUserId: null,
        managerFullName: null,
        inn: null,
        phone: null,
        legalEntity: false,
        tradePointIds: [],
        tradePointsCount: 0,
      },
    ],
  ]);

  it("resolveClientExternalKey strips client- prefix", () => {
    expect(resolveClientExternalKey("client-dealer-a", catalogKeys)).toBe("dealer-a");
  });

  it("merges catalog with actualization statuses and extras", () => {
    const actualizationClients: ClientBaseActualizationClient[] = [
      {
        id: "dealer-a",
        fullName: "A active",
        city: "Москва",
        managerUserId: "m1",
        managerFullName: "Mgr",
        inn: null,
        phone: null,
        legalEntity: false,
        normalizedStatus: "active",
        updatedAt: "2026-01-01T00:00:00.000Z",
        tradePointIds: [],
      },
      {
        id: "dealer-potential-only",
        fullName: "Potential only",
        city: null,
        managerUserId: "m1",
        managerFullName: "Mgr",
        inn: null,
        phone: null,
        legalEntity: false,
        normalizedStatus: "potential",
        updatedAt: "2026-01-01T00:00:00.000Z",
        tradePointIds: [],
      },
    ];
    const clients = mergeClientBaseClientsList({
      catalogKeys,
      catalogMeta,
      actualizationClients,
      staleCutoffMs: 0,
    });
    const counts = countClientsByListStatus(clients);
    expect(counts.all).toBe(3);
    expect(counts.active).toBe(1);
    expect(counts.potential).toBe(1);
    expect(counts.noStatus).toBe(2);
    expect(clients.find((c) => c.id === "dealer-potential-only")?.inCatalog).toBe(false);
  });
});
