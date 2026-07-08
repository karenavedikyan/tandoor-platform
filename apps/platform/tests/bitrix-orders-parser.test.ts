import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripUtf8Bom } from "../shared/admin/exchange-fetch.js";
import { parseBitrixDateTime, parseBitrixOrdersXml } from "../shared/bitrix-orders/parser.js";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "bitrix-orders", "fixtures", "orders11-sample.xml");
const sampleXml = readFileSync(fixturePath, "utf8");

describe("parseBitrixOrdersXml", () => {
  it("parses two orders from fixture", () => {
    const orders = parseBitrixOrdersXml(sampleXml);
    expect(orders).toHaveLength(2);
  });

  it("parses first order fields and empty payment method", () => {
    const [order] = parseBitrixOrdersXml(sampleXml);
    expect(order).toMatchObject({
      bitrixOrderId: "370baf06-505e-11f1-80bf-00155d60ef09",
      orderNumber: "БАMA-023103",
      siteId: "6C2UC25R",
      clientUuid: "f98d97c7-2998-11f0-8136-00155d0a0a4e",
      clientNumber1c: "MA-MA140755",
      status: "Закрыт",
      deliveryType: "Самовывоз",
      paymentMethod: null,
      paymentPercent: 0,
      totalWithDiscount: 58750,
      totalDiscount: 58750,
    });
    expect(order?.createdAtBitrix?.toISOString()).toBe("2026-05-15T13:01:40.000Z");
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0]).toMatchObject({
      lineNo: 1,
      productXmlId: "72cd046c-2f08-11ef-812f-00155d0a0a4e",
      productName1c: "Короб дверной",
      quantity: 5,
      discountPerItem: 0,
      priceNoDiscount: 685,
      discountId: null,
      productId1cInternal: "11851",
      supplyVariant: "Отгрузить",
    });
    expect(order?.items[0]?.supplyDate?.toISOString()).toBe("2026-05-21T21:00:00.000Z");
  });

  it("parses russian decimal comma and multiple line items", () => {
    const [, order] = parseBitrixOrdersXml(sampleXml);
    expect(order).toMatchObject({
      bitrixOrderId: "a1b2c3d4-505e-11f1-80bf-00155d60ef09",
      orderNumber: "БАMA-023104",
      paymentMethod: "Безнал",
      paymentPercent: 50.5,
      totalWithDiscount: 12345.67,
      totalDiscount: 1234.56,
    });
    expect(order?.items).toHaveLength(2);
    expect(order?.items[0]?.quantity).toBe(2.5);
    expect(order?.items[1]?.priceNoDiscount).toBeNull();
    expect(order?.items[1]?.discountId).toBeNull();
  });

  it("keeps raw payload object per order", () => {
    const [order] = parseBitrixOrdersXml(sampleXml);
    expect(order?.rawPayload).toBeTruthy();
    expect((order?.rawPayload as { Номер?: string }).Номер).toBe("БАMA-023103");
  });
});

describe("parseBitrixDateTime", () => {
  it("returns null for empty values", () => {
    expect(parseBitrixDateTime("")).toBeNull();
    expect(parseBitrixDateTime(null)).toBeNull();
  });
});

describe("stripUtf8Bom", () => {
  it("removes BOM prefix", () => {
    expect(stripUtf8Bom(`\uFEFF${sampleXml}`)).toBe(sampleXml);
  });
});
