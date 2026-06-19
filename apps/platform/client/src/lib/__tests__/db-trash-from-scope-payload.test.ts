/**
 * Промт 423: isDealerTrashedInScope читает из БД-payload, не jsonb.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state.js";
import { isDealerTrashedInScope } from "../client-base-actualization-visibility.js";

const act = createEmptyActualizationState();
act.trashedDealersById = {
  "dealer-jsonb-only": {
    dealerId: "dealer-jsonb-only",
    trashedAt: new Date().toISOString(),
    trashedBy: "u1",
    snapshot: {},
  },
};

assert.equal(isDealerTrashedInScope("dealer-jsonb-only", act), false, "jsonb alone must not mark trashed");

const dbKeys = new Set(["dealer-from-db"]);
assert.equal(
  isDealerTrashedInScope("dealer-from-db", act, { trashedDealerExternalKeys: dbKeys }),
  true,
  "DB payload keys mark trashed",
);

console.log("db-trash-from-scope-payload.test.ts OK");
