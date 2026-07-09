import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { build1cDealerRow, build1cPoint } from "../client/src/lib/one-c-dealer-shape.js";
import {
  getShowcaseMatrixApiBase,
  resetShowcaseMatrixApiBase,
  setShowcaseMatrixApiBase,
} from "../client/src/lib/showcase-matrix-api-base.js";
import {
  handleOneCShowcaseMatrixList,
  upsertOneCShowcaseMatrixEntry,
} from "../shared/one-c-showcase-matrix-handlers.js";
import type { PoolLike } from "../server/db/neon-client.js";

describe("one-c-dealer-shape", () => {
  const legal = {
    id_1c: "11111111-1111-1111-1111-111111111111",
    name: "ООО Тест",
    legal_name: "Общество с ограниченной ответственностью Тест",
    inn: "7701234567",
    kpp: "770101001",
    ogrn: "1027700132195",
    region: "Москва",
    city: "Москва",
    client_type: "ТОП 150",
    payment_form: "Безнал",
    phone: "+7 495 000-00-00",
    email: "test@example.com",
    discount_code: "D10",
    discount_percent: 10,
    responsible_manager_name: "Иванов Иван",
    regional_manager_name: "Петров Петр",
    plan_sum: 1000000,
    plan_retro_bonus: "5%",
  };

  it("build1cDealerRow maps legal fields", () => {
    const dealer = build1cDealerRow(legal, { canEditDistribution: true });
    expect(dealer.id).toBe(legal.id_1c);
    expect(dealer.name).toBe("ООО Тест");
    expect(dealer.legalEntity).toContain("Общество");
    expect(dealer.actualizationInn).toBe("7701234567");
    expect(dealer.city).toBe("Москва");
    expect(dealer.region).toBe("Москва");
    expect(dealer.clientCategory).toBe("top150");
    expect(dealer.status).toBe("активный");
    expect(dealer.format).toBe("одиночный");
    expect(dealer.source1c).toBe(true);
    expect(dealer.oneCDistributionCanEdit).toBe(true);
    expect(dealer.manager).toBe("Иванов Иван");
    expect(dealer.contacts.phone).toBe("+7 495 000-00-00");
    expect(dealer.terms.payment).toBe("Безнал");
  });

  it("build1cPoint maps store fields", () => {
    const store = {
      id_1c: "22222222-2222-2222-2222-222222222222",
      address: "ул. Примерная, 1",
      name: "ТТ",
      manager_name: "Сидоров",
      manager_phone: "+7 900 000-00-00",
      legal_entity_1c: legal.id_1c,
    };
    const point = build1cPoint(store, legal);
    expect(point.id).toBe(store.id_1c);
    expect(point.address).toBe("ул. Примерная, 1");
    expect(point.city).toBe("Москва");
    expect(point.format).toBe("ТТ");
    expect(point.responsibleRegionalManager).toBe("Петров Петр");
  });
});

describe("showcase-matrix-api-base", () => {
  afterEach(() => resetShowcaseMatrixApiBase());

  it("switches API base URL", () => {
    expect(getShowcaseMatrixApiBase()).toBe("/api/showcase-matrix");
    setShowcaseMatrixApiBase("/api/one-c/showcase-matrix");
    expect(getShowcaseMatrixApiBase()).toBe("/api/one-c/showcase-matrix");
    resetShowcaseMatrixApiBase();
    expect(getShowcaseMatrixApiBase()).toBe("/api/showcase-matrix");
  });
});

describe("one-c-showcase-matrix handlers", () => {
  const storeId = "22222222-2222-2222-2222-222222222222";
  const legalId = "11111111-1111-1111-1111-111111111111";
  const modelId = "33333333-3333-3333-3333-333333333333";

  function makePool(rows: Record<string, unknown>[] = []): PoolLike {
    return {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM users WHERE id")) {
          return {
            rows: [{ id: params?.[0], role: "admin", status: "active", full_name: "Admin" }],
          };
        }
        if (sql.includes("FROM exchange_stores_raw s") && sql.includes("legal_entity_1c")) {
          return {
            rows: [
              {
                regional_manager_name: "RM",
                responsible_manager_name: "Resp",
              },
            ],
          };
        }
        if (sql.includes("FROM exchange_stores_raw WHERE id_1c")) {
          return { rows: [{ n: 1 }] };
        }
        if (sql.includes("INSERT INTO showcase_distribution_overrides_1c")) {
          return {
            rows: [
              {
                id: "entry-1",
                store_id_1c: storeId,
                target_kind: "model",
                target_id: modelId,
                status: "installed",
                comment: null,
                updated_at: new Date().toISOString(),
                updated_by: params?.[6],
                updated_by_name: params?.[7],
                placement_type: "portal",
                placement_segment: "vh",
                placement_capacity: null,
                placement_actual: null,
                placement_ref: null,
                placement_our_models: [],
                placement_competitors: [],
                placement_legacy_ours: null,
              },
            ],
          };
        }
        if (sql.includes("SELECT * FROM showcase_distribution_overrides_1c") && sql.includes("client_op_id")) {
          return { rows: [] };
        }
        if (sql.includes("SELECT * FROM showcase_distribution_overrides_1c") && sql.includes("target_kind = $2")) {
          return { rows: [] };
        }
        if (sql.includes("FROM showcase_distribution_overrides_1c o")) {
          return { rows };
        }
        if (sql.includes("INSERT INTO showcase_matrix_events_1c")) {
          return { rows: [] };
        }
        if (sql.includes("INSERT INTO showcase_distribution_history_1c")) {
          return { rows: [] };
        }
        if (sql.includes("INSERT INTO showcase_matrix_1c")) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as PoolLike;
  }

  it("list returns ShowcaseMatrixEntryDto shape", async () => {
    const pool = makePool([
      {
        id: "e1",
        store_id_1c: storeId,
        target_kind: "model",
        target_id: modelId,
        status: "need_install",
        comment: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        updated_by_name: null,
        placement_type: null,
        placement_segment: null,
        placement_capacity: null,
        placement_actual: null,
        placement_ref: null,
        placement_our_models: [],
        placement_competitors: [],
        placement_legacy_ours: null,
        dealer_id_resolved: legalId,
      },
    ]);
    const res = await handleOneCShowcaseMatrixList(pool, {
      tradePointId: storeId,
      dealerId: legalId,
    });
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0]?.dealerId).toBe(legalId);
    expect(res.entries[0]?.tradePointId).toBe(storeId);
    expect(res.entries[0]?.targetKind).toBe("model");
    expect(res.entries[0]?.targetId).toBe(modelId);
    expect(res.entries[0]?.targetName).toBeNull();
  });

  it("list resolves catalog product name for model targets", async () => {
    const pool = makePool([
      {
        id: "e1",
        store_id_1c: storeId,
        target_kind: "model",
        target_id: modelId,
        status: "installed",
        comment: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        updated_by_name: null,
        placement_type: "portal",
        placement_segment: "vh",
        placement_capacity: null,
        placement_actual: null,
        placement_ref: null,
        placement_our_models: [],
        placement_competitors: [],
        placement_legacy_ours: null,
        dealer_id_resolved: legalId,
        target_name: "Дверь Тестовая",
      },
    ]);
    const res = await handleOneCShowcaseMatrixList(pool, {
      tradePointId: storeId,
      dealerId: legalId,
    });
    expect(res.entries[0]?.targetName).toBe("Дверь Тестовая");
  });

  it("upsert writes entry and checks permissions", async () => {
    const pool = makePool();
    await expect(
      upsertOneCShowcaseMatrixEntry(
        pool,
        { id: "user-1", role: "admin", status: "active", fullName: "Admin" },
        {
          dealerId: legalId,
          tradePointId: storeId,
          targetKind: "model",
          targetId: modelId,
          status: "installed",
          placementType: "portal",
          placementSegment: "vh",
        },
      ),
    ).resolves.toMatchObject({
      entry: { targetKind: "model", status: "installed" },
      idempotent: false,
    });
  });
});
