import { Prisma, type PrismaClient } from "@prisma/client";
import { fetchBitrixOrdersXml } from "../admin/exchange-fetch.js";
import { resolveOrderContext } from "./matcher.js";
import { parseBitrixOrdersXml, type ParsedBitrixOrder } from "./parser.js";

const SYNC_SOURCE = "bitrix_orders_ftp";

export type BitrixOrdersSyncResult = {
  id: string;
  startedAt: Date;
  finishedAt: Date;
  source: string;
  sourceFile: string | null;
  ordersSeen: number;
  ordersUpserted: number;
  ordersMatchedStore: number;
  ordersUnmatched: number;
  status: string;
  message: string | null;
  durationMs: number;
};

export type SyncBitrixOrdersOptions = {
  sourceFile?: string;
  xml?: string;
};

function decimalOrNull(value: number | null): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(value);
}

async function resolveProductIds(
  prisma: PrismaClient,
  productXmlIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(productXmlIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await prisma.catalogProduct.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  return new Map(rows.map((r) => [r.id, r.id]));
}

async function upsertOneOrder(
  tx: Prisma.TransactionClient,
  order: ParsedBitrixOrder,
  sourceFile: string,
  productIds: Map<string, string>,
  context: { storeUuid: string | null; legalUuid: string | null; managerUuid: string | null },
): Promise<{ matchedStore: boolean; unmatched: boolean }> {
  const snapshot = await tx.bitrixOrdersSnapshot.upsert({
    where: { bitrixOrderId: order.bitrixOrderId },
    create: {
      bitrixOrderId: order.bitrixOrderId,
      orderNumber: order.orderNumber,
      siteId: order.siteId,
      clientUuid: order.clientUuid,
      clientNumber1c: order.clientNumber1c,
      storeUuid: context.storeUuid,
      legalUuid: context.legalUuid,
      managerUuid: context.managerUuid,
      status: order.status,
      deliveryType: order.deliveryType,
      deliveryAddress: order.deliveryAddress,
      paymentMethod: order.paymentMethod,
      paymentPercent: decimalOrNull(order.paymentPercent),
      totalWithDiscount: decimalOrNull(order.totalWithDiscount),
      totalDiscount: decimalOrNull(order.totalDiscount),
      createdAtBitrix: order.createdAtBitrix,
      rawPayload: order.rawPayload as Prisma.InputJsonValue,
      sourceFile,
    },
    update: {
      orderNumber: order.orderNumber,
      siteId: order.siteId,
      clientUuid: order.clientUuid,
      clientNumber1c: order.clientNumber1c,
      storeUuid: context.storeUuid,
      legalUuid: context.legalUuid,
      managerUuid: context.managerUuid,
      status: order.status,
      deliveryType: order.deliveryType,
      deliveryAddress: order.deliveryAddress,
      paymentMethod: order.paymentMethod,
      paymentPercent: decimalOrNull(order.paymentPercent),
      totalWithDiscount: decimalOrNull(order.totalWithDiscount),
      totalDiscount: decimalOrNull(order.totalDiscount),
      createdAtBitrix: order.createdAtBitrix,
      rawPayload: order.rawPayload as Prisma.InputJsonValue,
      sourceFile,
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  await tx.bitrixOrderItemSnapshot.deleteMany({ where: { orderId: snapshot.id } });

  if (order.items.length > 0) {
    await tx.bitrixOrderItemSnapshot.createMany({
      data: order.items.map((item) => ({
        orderId: snapshot.id,
        lineNo: item.lineNo,
        productXmlId: item.productXmlId,
        productId: productIds.get(item.productXmlId) ?? null,
        productName1c: item.productName1c,
        quantity: decimalOrNull(item.quantity)!,
        discountPerItem: decimalOrNull(item.discountPerItem),
        priceNoDiscount: decimalOrNull(item.priceNoDiscount),
        discountId: item.discountId,
        productId1cInternal: item.productId1cInternal,
        priceTypeUuid: item.priceTypeUuid,
        supplyVariant: item.supplyVariant,
        supplyDate: item.supplyDate,
      })),
    });
  }

  const matchedStore = context.storeUuid != null;
  const unmatched = order.clientNumber1c != null && context.legalUuid == null;
  return { matchedStore, unmatched };
}

export async function syncBitrixOrders(
  prisma: PrismaClient,
  options: SyncBitrixOrdersOptions = {},
): Promise<BitrixOrdersSyncResult> {
  const startedAt = Date.now();
  const started = new Date(startedAt);

  let sourceFile = options.sourceFile ?? null;
  let xml = options.xml;

  if (!xml) {
    const fetched = await fetchBitrixOrdersXml();
    xml = fetched.xml;
    sourceFile = fetched.sourceFile;
  }

  const orders = parseBitrixOrdersXml(xml);
  const productIds = await resolveProductIds(
    prisma,
    orders.flatMap((o) => o.items.map((i) => i.productXmlId)),
  );

  const warnings: string[] = [];
  let ordersUpserted = 0;
  let ordersMatchedStore = 0;
  let ordersUnmatched = 0;

  const logRow = await prisma.$transaction(async (tx) => {
    for (const order of orders) {
      try {
        const context = await resolveOrderContext(tx, order.clientNumber1c);
        const result = await upsertOneOrder(tx, order, sourceFile ?? "orders11.xml", productIds, context);
        ordersUpserted += 1;
        if (result.matchedStore) ordersMatchedStore += 1;
        if (result.unmatched) ordersUnmatched += 1;
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        warnings.push(`order ${order.bitrixOrderId}: ${m}`);
      }
    }

    const finishedAt = new Date();
    const durationMs = Date.now() - startedAt;
    const status = warnings.length > 0 ? "error" : "ok";
    const message = warnings.length > 0 ? warnings.join("; ").slice(0, 4000) : null;

    return tx.bitrixOrdersSyncLog.create({
      data: {
        startedAt: started,
        finishedAt,
        source: SYNC_SOURCE,
        sourceFile,
        ordersSeen: orders.length,
        ordersUpserted,
        ordersMatchedStore,
        ordersUnmatched,
        status,
        message,
        durationMs,
      },
    });
  });

  return {
    id: logRow.id,
    startedAt: logRow.startedAt,
    finishedAt: logRow.finishedAt ?? new Date(),
    source: logRow.source,
    sourceFile: logRow.sourceFile,
    ordersSeen: logRow.ordersSeen,
    ordersUpserted: logRow.ordersUpserted,
    ordersMatchedStore: logRow.ordersMatchedStore,
    ordersUnmatched: logRow.ordersUnmatched,
    status: logRow.status,
    message: logRow.message,
    durationMs: logRow.durationMs ?? Date.now() - startedAt,
  };
}
