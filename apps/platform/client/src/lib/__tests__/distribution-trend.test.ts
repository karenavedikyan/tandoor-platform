/**
 * Запуск: npm run test:distribution-trend
 */
import assert from "node:assert/strict";
import type { ShowcaseMatrixEventDto } from "@/lib/showcase-matrix-api";
import { bucketKeyForIso, buildDistributionTrend } from "../distribution-trend";

function event(
  changedAt: string,
  oldStatus: string | null,
  newStatus: string | null,
): ShowcaseMatrixEventDto {
  return {
    id: `ev-${changedAt}-${newStatus}`,
    entryId: "e1",
    dealerId: "d1",
    tradePointId: "tp1",
    targetKind: "model",
    targetId: "m1",
    oldStatus,
    newStatus,
    comment: null,
    changedBy: null,
    changedByName: null,
    changedAt,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
  };
}

assert.equal(bucketKeyForIso("2026-06-04T15:00:00.000Z", "day"), "2026-06-04");
assert.equal(bucketKeyForIso("2026-06-04T15:00:00.000Z", "week"), "2026-06-01");
assert.equal(bucketKeyForIso("2026-06-08T10:00:00.000Z", "week"), "2026-06-08");

const events = [
  event("2026-06-01T10:00:00.000Z", "need_install", "installed"),
  event("2026-06-01T12:00:00.000Z", "installed", "postponed"),
  event("2026-06-03T10:00:00.000Z", null, "need_install"),
  event("2026-06-03T11:00:00.000Z", "need_install", "installed"),
];

const byDay = buildDistributionTrend(events, "day");
assert.equal(byDay.length, 2);
assert.equal(byDay[0]!.bucketIso, "2026-06-01");
assert.equal(byDay[0]!.installEvents, 1);
assert.equal(byDay[0]!.changeEvents, 2);
assert.equal(byDay[1]!.installEvents, 1);
assert.equal(byDay[0]!.cumulativeInstalled, 1);
assert.equal(byDay[1]!.cumulativeInstalled, 2);
assert.ok(byDay[1]!.cumulativeInstalled >= byDay[0]!.cumulativeInstalled);

const byWeek = buildDistributionTrend(events, "week");
assert.ok(byWeek.length >= 1);
assert.ok(byWeek.reduce((s, p) => s + p.installEvents, 0) === 2);

assert.deepEqual(buildDistributionTrend([], "day"), []);

console.log("distribution-trend: ok");
