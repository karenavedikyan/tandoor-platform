/**
 * Запуск: npx tsx client/src/hooks/__tests__/use-subject-scope-actualization-state.test.ts
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import {
  resolveSubjectScopeActualizationStateSync,
  shouldMirrorSubjectManagerActualizationState,
} from "../use-subject-scope-actualization-state";

const subjectState = createEmptyActualizationState();
subjectState.updatedAt = "2026-01-01T00:00:00.000Z";

assert.equal(
  resolveSubjectScopeActualizationStateSync(
    [
      { userId: "mgr-a", state: subjectState },
      { userId: "mgr-b", state: createEmptyActualizationState() },
    ],
    "mgr-a",
  ),
  subjectState,
);

assert.equal(
  resolveSubjectScopeActualizationStateSync([{ userId: "mgr-a", state: subjectState }], "mgr-x"),
  undefined,
);

assert.equal(
  shouldMirrorSubjectManagerActualizationState(true, "mgr-a", true, "manager"),
  true,
);
assert.equal(
  shouldMirrorSubjectManagerActualizationState(true, "mgr-a", true, "regional_manager"),
  true,
);
assert.equal(
  shouldMirrorSubjectManagerActualizationState(true, "mgr-a", true, "rop"),
  false,
);
assert.equal(
  shouldMirrorSubjectManagerActualizationState(false, "mgr-a", true, "manager"),
  false,
);
assert.equal(
  shouldMirrorSubjectManagerActualizationState(true, "mgr-a", false, "manager"),
  false,
);

console.log("use-subject-scope-actualization-state: ok");
