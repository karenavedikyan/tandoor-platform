/**
 * Запуск: npm run test:distribution-entry-tradepoint-view
 */
import assert from "node:assert/strict";
import {
  DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY,
  migrateDistributionEntryTradePointView,
  readDistributionEntryTradePointView,
  writeDistributionEntryTradePointView,
} from "../distribution-entry-tradepoint-view.js";

function withStorage(values: Record<string, string>, fn: () => void): void {
  const store = new Map<string, string>(Object.entries(values));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
  try {
    fn();
  } finally {
    if (originalWindow === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
}

{
  assert.equal(migrateDistributionEntryTradePointView("compact"), "compact");
  assert.equal(migrateDistributionEntryTradePointView("detailed"), "detailed");
  assert.equal(migrateDistributionEntryTradePointView("list"), "compact");
  assert.equal(migrateDistributionEntryTradePointView("grid"), "detailed");
  assert.equal(migrateDistributionEntryTradePointView("large"), "detailed");
  assert.equal(migrateDistributionEntryTradePointView("unknown"), null);
}

{
  withStorage({ [DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY]: "list" }, () => {
    assert.equal(readDistributionEntryTradePointView(false), "compact");
  });
  withStorage({ [DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY]: "grid" }, () => {
    assert.equal(readDistributionEntryTradePointView(true), "detailed");
  });
  withStorage({ [DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY]: "large" }, () => {
    assert.equal(readDistributionEntryTradePointView(false), "detailed");
  });
  withStorage({ [DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY]: "weird" }, () => {
    assert.equal(readDistributionEntryTradePointView(false), "detailed");
    assert.equal(readDistributionEntryTradePointView(true), "compact");
  });
  withStorage({}, () => {
    assert.equal(readDistributionEntryTradePointView(false), "detailed");
    assert.equal(readDistributionEntryTradePointView(true), "compact");
  });
}

{
  withStorage({}, () => {
    writeDistributionEntryTradePointView("compact");
    assert.equal(window.localStorage.getItem(DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY), "compact");
  });
}

console.log("distribution-entry-tradepoint-view: ok");
