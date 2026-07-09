import assert from "node:assert/strict";
import {
  buildInitialDraftRow,
  collectChangedProductIds,
  isInstalledMatrixStatus,
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

assert.equal(isInstalledMatrixStatus("installed"), true);
assert.equal(isInstalledMatrixStatus("postponed"), false);

const draft0 = buildInitialDraftRow(baseline);
assert.equal(draft0.status, "need_install");
assert.equal(draft0.placementType, "portal");

const draftInstalled = {
  ...draft0,
  status: "installed" as const,
  placementType: "cube" as const,
  placementSegment: "vh" as const,
};
assert.equal(draftRowEqualsBaseline(draft0, baseline), true);
assert.equal(draftRowEqualsBaseline(draftInstalled, baseline), false);

const installedBaseline: FullscreenEntryBaseline = {
  status: "installed",
  placementType: "portal",
  placementSegment: "mk",
  comment: "",
};
const draftInstalledMatch = buildInitialDraftRow(installedBaseline);
assert.equal(draftRowEqualsBaseline(draftInstalledMatch, installedBaseline), true);
assert.equal(
  draftRowEqualsBaseline({ ...draftInstalledMatch, placementType: "cube" }, installedBaseline),
  false,
);

assert.equal(draftRowEqualsBaseline({ ...draft0, status: "postponed" }, baseline), false);
assert.equal(
  draftRowEqualsBaseline({ ...draft0, status: "postponed", placementType: "cube" }, { ...baseline, status: "postponed" }),
  true,
);
assert.equal(
  draftRowEqualsBaseline({ ...draft0, status: "not_relevant" }, { ...baseline, status: "not_relevant" }),
  true,
);
assert.equal(
  draftRowEqualsBaseline(
    { ...draft0, status: "postponed", placementType: "cube", placementSegment: "vh" },
    { ...baseline, status: "postponed" },
  ),
  true,
);

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

const catalogOnlyDraft: FullscreenEntryDraftMap = {
  catalogNew: {
    status: "installed",
    placementType: "portal",
    placementSegment: "vh",
  },
};
assert.deepEqual(collectChangedProductIds(catalogOnlyDraft, {}), ["catalogNew"]);
assert.deepEqual(
  collectChangedProductIds(
    { catalogNew: buildInitialDraftRow(baseline) },
    {},
  ),
  [],
);

assert.equal(countInstalledInDraft(draftMap), 2);

console.log("distribution-fullscreen-entry-draft.test.ts: ok");
