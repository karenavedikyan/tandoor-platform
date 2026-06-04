import assert from "node:assert/strict";
import {
  buildInitialDraftRow,
  collectChangedProductIds,
  installedFromMatrixStatus,
  matrixStatusFromInstalled,
  draftRowEqualsBaseline,
  countInstalledInDraft,
  type FullscreenEntryBaseline,
  type FullscreenEntryDraftMap,
} from "../distribution-fullscreen-entry-draft";

const baseline: FullscreenEntryBaseline = {
  status: "need_install",
  placementType: null,
  placementSegment: null,
  comment: "",
};

assert.equal(installedFromMatrixStatus("installed"), true);
assert.equal(installedFromMatrixStatus("postponed"), false);
assert.equal(matrixStatusFromInstalled(true, "need_install"), "installed");
assert.equal(matrixStatusFromInstalled(false, "installed"), "need_install");
assert.equal(matrixStatusFromInstalled(false, "postponed"), "postponed");

const draft0 = buildInitialDraftRow(baseline);
assert.equal(draft0.installed, false);
assert.equal(draft0.placementType, "portal");

const draftInstalled = { ...draft0, installed: true, placementType: "cube" as const, placementSegment: "vh" as const };
assert.equal(draftRowEqualsBaseline(draft0, baseline), true);
assert.equal(draftRowEqualsBaseline(draftInstalled, baseline), false);

const baselines: Record<string, FullscreenEntryBaseline> = {
  a: baseline,
  b: { ...baseline, status: "installed", placementType: "portal", placementSegment: "mk" },
};
const draftMap: FullscreenEntryDraftMap = {
  a: draft0,
  b: buildInitialDraftRow(baselines.b),
};
assert.deepEqual(collectChangedProductIds(draftMap, baselines), []);
draftMap.a = draftInstalled;
assert.deepEqual(collectChangedProductIds(draftMap, baselines), ["a"]);
assert.equal(countInstalledInDraft(draftMap), 2);

console.log("distribution-fullscreen-entry-draft.test.ts: ok");
