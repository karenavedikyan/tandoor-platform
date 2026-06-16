/**
 * Запуск: `npm run test:dealers-db-to-dealer-row` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { buildDealerRowsFromReleaseClients } from "../../../client/src/lib/dealer-base-mock-data.js";
import { getReleaseClients } from "../../../client/src/lib/release-client-data.js";
import { buildDealerSeedBundle } from "../../../shared/dealers-seed-logic.js";
import type { DbDealerBundle } from "../db-dealers-loader.js";
import { dbDealerToDealerRow } from "../db-to-dealer-row.js";
import { COMPARABLE_DEALER_FIELDS, COMPARABLE_TP_FIELDS, diffDealerRow } from "../shadow-diff.js";

function bundleFromReleaseClient(id: string): DbDealerBundle | null {
  const client = getReleaseClients().find((c) => c.id === id);
  if (!client) return null;
  const bundle = buildDealerSeedBundle(client);
  return {
    dealer: {
      external_key: bundle.dealer.externalKey,
      name: bundle.dealer.name,
      release_code: bundle.dealer.releaseCode,
      city: bundle.dealer.city,
      region: bundle.dealer.region,
      client_type: bundle.dealer.clientType,
      client_category: bundle.dealer.clientCategory,
      status: bundle.dealer.status,
      format: bundle.dealer.format,
      is_active: bundle.dealer.isActive,
      is_priority: bundle.dealer.isPriority,
      is_closed: bundle.dealer.isClosed,
      legal_entity: bundle.dealer.legalEntity,
      holding: bundle.dealer.holding,
      comment: bundle.dealer.comment,
      manager_name: bundle.dealer.managerName,
      release_address: bundle.dealer.releaseAddress,
      client_type_label: bundle.dealer.clientTypeLabel,
      release_team_id: bundle.dealer.releaseTeamId,
      release_manager_id: bundle.dealer.releaseManagerId,
      source: bundle.dealer.source,
    },
    tradePoints: bundle.tradePoints.map((tp) => ({
      external_key: tp.externalKey,
      dealer_external_key: tp.dealerExternalKey,
      name: tp.name,
      city: tp.city,
      address: tp.address,
      format: tp.format,
      is_active: tp.isActive,
      importance_tier: tp.importanceTier,
    })),
  };
}

function assertComparableMatch(seedId: string, label: string): void {
  const seedRow = buildDealerRowsFromReleaseClients(
    getReleaseClients().filter((c) => c.id === seedId),
  )[0];
  const bundle = bundleFromReleaseClient(seedId);
  assert.ok(seedRow, `${label}: seed row`);
  assert.ok(bundle, `${label}: bundle`);

  const dbRow = dbDealerToDealerRow(bundle);
  const diffs = diffDealerRow(seedRow, dbRow);
  const unexpected = diffs.filter((d) => d.diffKind === "value_mismatch" || d.diffKind === "tp_count_mismatch");
  if (unexpected.length > 0) {
    console.error(`${label} diffs:`, unexpected.slice(0, 5));
  }
  assert.equal(unexpected.length, 0, `${label}: comparable fields match seed`);
}

// Клиент с одной ТТ (есть address)
assertComparableMatch("client-ma-ma085093", "with-single-tp");

// Клиент без ТТ (пустой address)
assertComparableMatch("client-ma-ma085529", "without-tp");

// Koteneva: несколько parsedTradePoints
{
  const multi = getReleaseClients().find((c) => c.parsedTradePoints && c.parsedTradePoints.length > 1);
  assert.ok(multi, "koteneva multi-tp fixture");
  assertComparableMatch(multi.id, "multi-tp");
}

// Структурная совместимость полей
{
  const sample = buildDealerRowsFromReleaseClients([getReleaseClients()[0]!])[0]!;
  const bundle = bundleFromReleaseClient(sample.id)!;
  const dbRow = dbDealerToDealerRow(bundle);
  for (const key of COMPARABLE_DEALER_FIELDS) {
    assert.ok(key in dbRow, `db row has ${key}`);
    assert.ok(key in sample, `seed row has ${key}`);
  }
  if (sample.tradePoints[0] && dbRow.tradePoints[0]) {
    for (const key of COMPARABLE_TP_FIELDS) {
      assert.ok(key in dbRow.tradePoints[0]!, `db tp has ${key}`);
      assert.ok(key in sample.tradePoints[0]!, `seed tp has ${key}`);
    }
  }
}

console.log("db-to-dealer-row.test.ts: ok");
