import { describe, it, expect } from "vitest";

function effectiveVisPayloadForForUserId(targetScope: {
  ready: boolean;
  scope_explanation: { full_catalog: boolean };
  activeDealerExternalKeySet: Set<string>;
}) {
  if (!targetScope.ready) return null;
  if (targetScope.scope_explanation.full_catalog) return { all: true, codes: null };
  const rawCodes = Array.from(targetScope.activeDealerExternalKeySet).map((k) =>
    k.startsWith("client-") ? k.slice("client-".length) : k,
  );
  return { all: false, codes: rawCodes };
}

describe("392e: trade-points effectiveVisPayload — нормализация external_keys", () => {
  it("отрезает префикс client- и оставляет lowercase release_code", () => {
    const out = effectiveVisPayloadForForUserId({
      ready: true,
      scope_explanation: { full_catalog: false },
      activeDealerExternalKeySet: new Set(["client-ma-ma085093", "client-000000156"]),
    });
    expect(out).toEqual({ all: false, codes: ["ma-ma085093", "000000156"] });
  });

  it("full_catalog → all:true, codes:null", () => {
    const out = effectiveVisPayloadForForUserId({
      ready: true,
      scope_explanation: { full_catalog: true },
      activeDealerExternalKeySet: new Set(),
    });
    expect(out).toEqual({ all: true, codes: null });
  });

  it("not ready → null", () => {
    const out = effectiveVisPayloadForForUserId({
      ready: false,
      scope_explanation: { full_catalog: false },
      activeDealerExternalKeySet: new Set(),
    });
    expect(out).toBeNull();
  });
});
