/**
 * Запуск: `npm run test:hash-route-utils` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { readHashRouteQuery } from "../hash-route-utils";

type LocationMock = {
  search: string;
  hash: string;
};

function withLocation(loc: LocationMock, fn: () => void): void {
  const prev = (globalThis as { window?: { location: LocationMock } }).window;
  (globalThis as { window: { location: LocationMock } }).window = { location: loc };
  try {
    fn();
  } finally {
    if (prev) {
      (globalThis as { window: { location: LocationMock } }).window = prev;
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
}

{
  withLocation({ search: "?a=1", hash: "#/distribution?view=analytics&tab=product" }, () => {
    const qs = readHashRouteQuery();
    assert.equal(qs.get("a"), "1");
    assert.equal(qs.get("view"), "analytics");
    assert.equal(qs.get("tab"), "product");
  });
}

{
  withLocation({ search: "?view=entry", hash: "#/distribution?view=analytics" }, () => {
    const qs = readHashRouteQuery();
    assert.equal(qs.get("view"), "analytics");
  });
}

{
  withLocation({ search: "?view=analytics", hash: "#/distribution" }, () => {
    const qs = readHashRouteQuery();
    assert.equal(qs.get("view"), "analytics");
    assert.equal(qs.get("tab"), null);
  });
}

{
  withLocation({ search: "", hash: "#/distribution" }, () => {
    const qs = readHashRouteQuery();
    assert.equal(qs.toString(), "");
    assert.equal(qs.get("view"), null);
  });
}

console.log("hash-route-utils: ok");
