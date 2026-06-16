/**
 * Запуск: `npm run test:dealers-shadow-diff` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { buildDealerRowsFromReleaseClients } from "../../../client/src/lib/dealer-base-mock-data.js";
import { getReleaseClients } from "../../../client/src/lib/release-client-data.js";
import {
  COMPARABLE_DEALER_FIELDS,
  diffDealerCatalogs,
  diffDealerRow,
  summarizeDiffEntries,
} from "../shadow-diff.js";

const allSeed = buildDealerRowsFromReleaseClients(getReleaseClients());

function pickSample(ids: string[]): typeof allSeed {
  const map = new Map(allSeed.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean) as typeof allSeed;
}

// Идентичные строки → 0 diff
{
  const sample = allSeed[0];
  assert.ok(sample, "seed row exists");
  const diffs = diffDealerRow(sample, { ...sample, tradePoints: [...sample.tradePoints] });
  assert.equal(diffs.length, 0, "identical rows produce no diffs");
}

// Расхождение поля
{
  const sample = allSeed[0]!;
  const mutated = { ...sample, name: `${sample.name} (changed)` };
  const diffs = diffDealerRow(sample, mutated);
  assert.ok(diffs.some((d) => d.field === "name" && d.diffKind === "value_mismatch"));
}

// tp_count_mismatch
{
  const withTps =
    allSeed.find((r) => r.tradePoints.length > 1) ??
    allSeed.find((r) => r.tradePoints.length === 1);
  assert.ok(withTps, "fixture with trade points");
  const fewerTps = { ...withTps, tradePoints: [], outlets: 0 };
  const diffs = diffDealerRow(withTps, fewerTps);
  assert.ok(diffs.some((d) => d.diffKind === "tp_count_mismatch"));
}

// missing_in_db / missing_in_seed
{
  const a = allSeed[0]!;
  const entries = diffDealerCatalogs([a], []);
  assert.ok(entries.some((e) => e.diffKind === "missing_in_db"));
  const entries2 = diffDealerCatalogs([], [a]);
  assert.ok(entries2.some((e) => e.diffKind === "missing_in_seed"));
}

// 5 случайных seed-строк против самих себя
{
  const indices = [10, 100, 500, 1000, 2000].filter((i) => i < allSeed.length);
  const samples = indices.map((i) => allSeed[i]!);
  const entries = diffDealerCatalogs(samples, samples);
  assert.equal(entries.length, 0, "self-catalog diff is empty");
}

// summary
{
  const a = allSeed[0]!;
  const b = { ...a, city: "Другой город" };
  const entries = diffDealerCatalogs([a], [b]);
  const summary = summarizeDiffEntries([a], [b], entries);
  assert.equal(summary.totalSeed, 1);
  assert.equal(summary.totalDb, 1);
  assert.ok(summary.valueMismatches >= 1);
}

// comparable fields list covers core identity
{
  assert.ok(COMPARABLE_DEALER_FIELDS.includes("id"));
  assert.ok(COMPARABLE_DEALER_FIELDS.includes("releaseCode"));
  assert.ok(COMPARABLE_DEALER_FIELDS.includes("name"));
}

console.log("shadow-diff.smoke.test.ts: ok");
