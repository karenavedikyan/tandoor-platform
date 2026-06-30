/**
 * Вызывается из `seed-dealers-trade-points.mjs` через tsx.
 * Промт 348: идемпотентный seed дилеров и ТТ из release-client-data.
 */
import { eq, sql } from "drizzle-orm";
import { dealers, tradePoints } from "@shared/dealers-schema";
import { buildAllDealerSeedBundles } from "@shared/dealers-seed-logic";
import { getAuthDb } from "../server/auth/db";

type SeedCounters = {
  dealersInserted: number;
  dealersUpdated: number;
  tradePointsInserted: number;
  tradePointsUpdated: number;
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[seed-dealers-trade-points] DATABASE_URL is required.");
    process.exit(1);
  }

  const db = getAuthDb();
  if (!db) {
    console.error("[seed-dealers-trade-points] Auth database is not configured.");
    process.exit(1);
  }

  const bundles = buildAllDealerSeedBundles();
  const counters: SeedCounters = {
    dealersInserted: 0,
    dealersUpdated: 0,
    tradePointsInserted: 0,
    tradePointsUpdated: 0,
  };

  const dealerUuidByExternal = new Map<string, string>();

  for (const bundle of bundles) {
    const d = bundle.dealer;
    const existing = await db
      .select({ id: dealers.id })
      .from(dealers)
      .where(eq(dealers.externalKey, d.externalKey))
      .limit(1);

    let dealerUuid: string;
    if (existing[0]) {
      dealerUuid = existing[0].id;
      await db
        .update(dealers)
        .set({
          name: d.name,
          releaseCode: d.releaseCode,
          city: d.city,
          region: d.region,
          clientType: d.clientType,
          clientCategory: d.clientCategory,
          status: d.status,
          format: d.format,
          isActive: d.isActive,
          isPriority: d.isPriority,
          isClosed: d.isClosed,
          legalEntity: d.legalEntity,
          holding: d.holding,
          comment: d.comment,
          managerName: d.managerName,
          releaseAddress: d.releaseAddress,
          clientTypeLabel: d.clientTypeLabel,
          releaseTeamId: d.releaseTeamId,
          releaseManagerId: d.releaseManagerId,
          source: d.source,
          updatedAt: sql`now()`,
        })
        .where(eq(dealers.id, dealerUuid));
      counters.dealersUpdated += 1;
    } else {
      const inserted = await db
        .insert(dealers)
        .values({
          externalKey: d.externalKey,
          name: d.name,
          releaseCode: d.releaseCode,
          city: d.city,
          region: d.region,
          clientType: d.clientType,
          clientCategory: d.clientCategory,
          status: d.status,
          format: d.format,
          isActive: d.isActive,
          isPriority: d.isPriority,
          isClosed: d.isClosed,
          legalEntity: d.legalEntity,
          holding: d.holding,
          comment: d.comment,
          managerName: d.managerName,
          releaseAddress: d.releaseAddress,
          clientTypeLabel: d.clientTypeLabel,
          releaseTeamId: d.releaseTeamId,
          releaseManagerId: d.releaseManagerId,
          source: d.source,
        })
        .returning({ id: dealers.id });
      dealerUuid = inserted[0]!.id;
      counters.dealersInserted += 1;
    }

    dealerUuidByExternal.set(d.externalKey, dealerUuid);

    await db.update(tradePoints).set({ isPrimary: false }).where(eq(tradePoints.dealerId, dealerUuid));

    for (const tp of bundle.tradePoints) {
      const tpExisting = await db
        .select({ id: tradePoints.id })
        .from(tradePoints)
        .where(eq(tradePoints.externalKey, tp.externalKey))
        .limit(1);

      if (tpExisting[0]) {
        await db
          .update(tradePoints)
          .set({
            name: tp.name,
            city: tp.city,
            address: tp.address,
            format: tp.format,
            isActive: tp.isActive,
            isPrimary: tp.isPrimary,
            importanceTier: tp.importanceTier,
            dealerId: dealerUuid,
            source: tp.source,
            updatedAt: sql`now()`,
          })
          .where(eq(tradePoints.id, tpExisting[0].id));
        counters.tradePointsUpdated += 1;
      } else {
        await db.insert(tradePoints).values({
          externalKey: tp.externalKey,
          dealerId: dealerUuid,
          name: tp.name,
          city: tp.city,
          address: tp.address,
          format: tp.format,
          isActive: tp.isActive,
          isPrimary: tp.isPrimary,
          importanceTier: tp.importanceTier,
          source: tp.source,
        });
        counters.tradePointsInserted += 1;
      }
    }
  }

  console.log(
    `[seed-dealers-trade-points] dealers: +${counters.dealersInserted} ~${counters.dealersUpdated}; trade_points: +${counters.tradePointsInserted} ~${counters.tradePointsUpdated}; bundles=${bundles.length}`,
  );
}

main().catch((e) => {
  console.error("[seed-dealers-trade-points]", e instanceof Error ? e.message : e);
  process.exit(1);
});
