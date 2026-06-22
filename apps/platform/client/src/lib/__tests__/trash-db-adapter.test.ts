/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { TRASH_RETENTION_MS } from "@/lib/client-base-actualization-state";
import {
  mapDbDealerOverrideToTrashedDealerInfo,
  mapDbTradePointOverrideToTrashedTradePointInfo,
} from "@/lib/trash-db-adapter";
import type { DealerOverrideRow } from "../../../shared/dealer-overrides-types";
import type { TradePointOverrideRow } from "../../../shared/trade-point-overrides-types";

const deps = { resolveUserName: (id: string | null | undefined) => (id ? `User ${id}` : "") };

function makeDealerRow(overrides: Partial<DealerOverrideRow> = {}): DealerOverrideRow {
  return {
    dealer_id: "dealer-1",
    status: "in_trash",
    name: "ООО Тест",
    city: "Краснодар",
    contact_name: null,
    contact_phone: null,
    contact_email: null,
    general_comment: null,
    client_category: null,
    trashed_at: "2026-06-01T10:00:00.000Z",
    trashed_by: "user-1",
    purge_requested_at: null,
    purge_requested_by: null,
    purged_at: null,
    purged_by: null,
    unloading_order: null,
    regional_manager_id: null,
    regional_manager_name: null,
    rop_id: null,
    rop_name: null,
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: "2026-06-01T10:00:00.000Z",
    updated_by: "user-1",
    ...overrides,
  };
}

describe("trash-db-adapter", () => {
  it("maps dealer override in_trash to TrashedDealerInfo with retention expiry", () => {
    const row = makeDealerRow();
    const info = mapDbDealerOverrideToTrashedDealerInfo(row, deps);
    expect(info).not.toBeNull();
    expect(info?.dealerId).toBe("dealer-1");
    expect(info?.trashedAt).toBe("2026-06-01T10:00:00.000Z");
    expect(info?.trashedByName).toBe("User user-1");
    expect(info?.snapshot.fullName).toBe("ООО Тест");
    expect(info?.snapshot.city).toBe("Краснодар");
    const expiresMs = Date.parse(info!.expiresAt) - Date.parse(row.trashed_at!);
    expect(expiresMs).toBe(TRASH_RETENTION_MS);
  });

  it("returns null when trashed_at is missing", () => {
    expect(mapDbDealerOverrideToTrashedDealerInfo(makeDealerRow({ trashed_at: null }), deps)).toBeNull();
  });

  it("maps trade point override in_trash to TrashedTradePointInfo", () => {
    const row: TradePointOverrideRow = {
      tp_id: "tp-1",
      dealer_id: "dealer-1",
      is_primary: false,
      status: "in_trash",
      name: "ТТ 1",
      city: "Краснодар",
      address: "ул. Тест",
      contact_name: null,
      contact_phone: null,
      comment: null,
      showcase_status: null,
      shipment_days: null,
      is_main_warehouse: null,
      is_hardware_warehouse: null,
      trashed_at: "2026-06-01T10:00:00.000Z",
      trashed_by: "user-2",
      purge_requested_at: null,
      purge_requested_by: null,
      purged_at: null,
      purged_by: null,
      rop_id: null,
      rop_name: null,
      regional_manager_id: null,
      regional_manager_name: null,
      created_at: "2026-06-01T10:00:00.000Z",
      updated_at: "2026-06-01T10:00:00.000Z",
      updated_by: "user-2",
    };
    const info = mapDbTradePointOverrideToTrashedTradePointInfo(row, deps);
    expect(info?.tradePointId).toBe("tp-1");
    expect(info?.dealerId).toBe("dealer-1");
    expect(info?.snapshot.address).toBe("ул. Тест");
  });
});
