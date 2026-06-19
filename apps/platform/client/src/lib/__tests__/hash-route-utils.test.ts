/**
 * Запуск: `npm run test:hash-route-utils` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { readHashRouteQuery, updateHashRouteParam } from "../hash-route-utils";

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

function withUpdateHashRouteEnv(loc: LocationMock, fn: (ctx: { getHashChangeCount: () => number }) => void): void {
  let hashChangeCount = 0;
  const location = {
    get search() {
      return loc.search;
    },
    get hash() {
      return loc.hash;
    },
    set hash(v: string) {
      loc.hash = v;
    },
  };
  const history = {
    replaceState(_state: unknown, _title: string, url: string) {
      const hashIdx = url.indexOf("#");
      if (hashIdx >= 0) loc.hash = url.slice(hashIdx);
      const beforeHash = url.slice(0, hashIdx);
      const qIdx = beforeHash.indexOf("?");
      loc.search = qIdx >= 0 ? beforeHash.slice(qIdx) : "";
    },
  };
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window: unknown }).window = {
    location,
    history,
    dispatchEvent: () => {
      hashChangeCount += 1;
      return true;
    },
    HashChangeEvent: class HashChangeEvent extends Event {
      constructor(type: string) {
        super(type);
      }
    },
  };
  try {
    fn({ getHashChangeCount: () => hashChangeCount });
  } finally {
    if (prevWindow) {
      (globalThis as { window: unknown }).window = prevWindow;
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

{
  const loc = { search: "", hash: "#/distribution/abc/xyz" };
  withUpdateHashRouteEnv(loc, () => {
    updateHashRouteParam("entry", "1");
    assert.equal(loc.hash, "#/distribution/abc/xyz?entry=1");
  });
}

{
  const loc = { search: "", hash: "#/distribution/abc/xyz?dx_source=all" };
  withUpdateHashRouteEnv(loc, () => {
    updateHashRouteParam("entry", "1");
    assert.equal(loc.hash, "#/distribution/abc/xyz?dx_source=all&entry=1");
  });
}

{
  const loc = { search: "", hash: "#/d?entry=0" };
  withUpdateHashRouteEnv(loc, () => {
    updateHashRouteParam("entry", "1");
    assert.equal(loc.hash, "#/d?entry=1");
  });
}

{
  const loc = { search: "", hash: "#/d?entry=1&dx_source=all" };
  withUpdateHashRouteEnv(loc, () => {
    updateHashRouteParam("entry", null);
    assert.equal(loc.hash, "#/d?dx_source=all");
  });
}

{
  const loc = { search: "", hash: "#/d?entry=1" };
  withUpdateHashRouteEnv(loc, () => {
    updateHashRouteParam("entry", null);
    assert.equal(loc.hash, "#/d");
  });
}

{
  const loc = { search: "", hash: "#/distribution/abc/xyz" };
  withUpdateHashRouteEnv(loc, ({ getHashChangeCount }) => {
    updateHashRouteParam("entry", "1");
    assert.equal(getHashChangeCount(), 1);
    const before = getHashChangeCount();
    updateHashRouteParam("entry", "1");
    assert.equal(getHashChangeCount(), before, "idempotent call should not dispatch hashchange");
  });
}

console.log("hash-route-utils: ok");
