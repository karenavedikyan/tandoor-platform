import { describe, expect, it } from "vitest";
import type { PoolLike } from "../server/db/neon-client.js";
import {
  countStoresForManager,
  fetchOneCManager,
  fetchOneCStore,
} from "../shared/one-c-showroom-handlers.js";

const MANAGER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001";
const STORE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001";
const LEGAL_ID = "cccccccc-cccc-4ccc-8ccc-cccccccc0001";

function createMockPool(): PoolLike {
  const stores = [
    {
      id_1c: STORE_ID,
      address: "г. Москва, ул. Тестовая, 1",
      manager_1c: MANAGER_ID,
      manager_name: "Иванов И.И.",
      manager_phone: "+79001112233",
      legal_entity_1c: LEGAL_ID,
      name: "ТТ",
      status: "imported",
      imported_at: "2026-07-01T12:00:00.000Z",
    },
    {
      id_1c: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
      address: "г. Казань, пр. Победы, 2",
      manager_1c: MANAGER_ID,
      manager_name: "Иванов И.И.",
      manager_phone: "+79001112233",
      legal_entity_1c: LEGAL_ID,
      name: "ТТ",
      status: "imported",
      imported_at: "2026-07-01T12:00:00.000Z",
    },
    {
      id_1c: "eeeeeeee-eeee-4eee-8eee-eeeeeeee0001",
      address: "г. Самара, ул. Ленина, 3",
      manager_1c: "ffffffff-ffff-4fff-8fff-ffffffff0001",
      manager_name: "Петров П.П.",
      manager_phone: null,
      legal_entity_1c: null,
      name: "ТТ",
      status: "imported",
      imported_at: "2026-07-01T12:00:00.000Z",
    },
  ];

  const users = [
    {
      id_1c: MANAGER_ID,
      name: "Иванов Иван Иванович",
      phone: "+79001112233",
      imported_at: "2026-07-01T12:00:00.000Z",
    },
  ];

  const legals = [
    {
      id_1c: LEGAL_ID,
      name: "Металлист ООО",
      legal_name: "Общество с ограниченной ответственностью «Металлист»",
      inn: "7701234567",
      kpp: "770101001",
      ogrn: "1027700132195",
      region: "Москва",
      city: "Москва",
      client_type: "Дилер",
      payment_form: "Безнал",
      phone: "+74951234567",
      email: "info@metalist.test",
      discount_code: "A1",
      discount_percent: 5,
      regional_manager_name: "Региональный",
      responsible_manager_name: "Ответственный",
      furniture_manager_name: "Фурнитура",
      furniture_manager_phone: "+79009998877",
      ma_number: "MA0001",
      plan_sum: 1000000,
      plan_retro_bonus: "Да",
      parent_1c: null,
      imported_at: "2026-07-01T12:00:00.000Z",
    },
  ];

  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      if (sql.includes("FROM exchange_users_raw u") && sql.includes("GROUP BY")) {
        const pattern = params?.[0] as string | null;
        const filtered = users.filter((u) => !pattern || u.name.toLowerCase().includes(pattern.replace(/%/g, "").toLowerCase()));
        const items = filtered.map((u) => ({
          id_1c: u.id_1c,
          name: u.name,
          phone: u.phone,
          store_count: stores.filter((s) => s.manager_1c === u.id_1c).length,
        }));
        return { rows: items as T[] };
      }

      if (sql.includes("COUNT(*)::int AS n FROM exchange_users_raw")) {
        return { rows: [{ n: users.length }] as T[] };
      }

      if (sql.includes("FROM exchange_users_raw u WHERE u.id_1c")) {
        const id = params?.[0] as string;
        const user = users.find((u) => u.id_1c === id);
        if (!user) return { rows: [] as T[] };
        const store_count = stores.filter((s) => s.manager_1c === id).length;
        return { rows: [{ ...user, store_count }] as T[] };
      }

      if (sql.includes("FROM exchange_stores_raw s") && sql.includes("LEFT JOIN exchange_legals_raw l") && sql.includes("s.manager_1c = $1")) {
        const managerId = params?.[0] as string;
        const pattern = params?.[1] as string | null;
        const rows = stores
          .filter((s) => s.manager_1c === managerId)
          .filter((s) => {
            if (!pattern) return true;
            const needle = pattern.replace(/%/g, "").toLowerCase();
            const legal = legals.find((l) => l.id_1c === s.legal_entity_1c);
            return (
              (s.address ?? "").toLowerCase().includes(needle) ||
              (legal?.name ?? "").toLowerCase().includes(needle) ||
              (legal?.legal_name ?? "").toLowerCase().includes(needle)
            );
          })
          .map((s) => {
            const legal = legals.find((l) => l.id_1c === s.legal_entity_1c);
            return {
              id_1c: s.id_1c,
              address: s.address,
              legal_name: legal?.name ?? null,
              legal_inn: legal?.inn ?? null,
              legal_city: legal?.city ?? null,
            };
          });
        return { rows: rows as T[] };
      }

      if (sql.includes("FROM exchange_stores_raw s") && sql.includes("LEFT JOIN exchange_legals_raw l") && sql.includes("WHERE s.id_1c = $1")) {
        const id = params?.[0] as string;
        const store = stores.find((s) => s.id_1c === id);
        if (!store) return { rows: [] as T[] };
        const legal = legals.find((l) => l.id_1c === store.legal_entity_1c);
        return {
          rows: [
            {
              id_1c: store.id_1c,
              address: store.address,
              name: store.name,
              status: store.status,
              imported_at: store.imported_at,
              manager_1c: store.manager_1c,
              manager_name: store.manager_name,
              manager_phone: store.manager_phone,
              legal_entity_1c: store.legal_entity_1c,
              legal_name: legal?.name ?? null,
              legal_legal_name: legal?.legal_name ?? null,
              legal_inn: legal?.inn ?? null,
              legal_kpp: legal?.kpp ?? null,
              legal_ogrn: legal?.ogrn ?? null,
              legal_region: legal?.region ?? null,
              legal_city: legal?.city ?? null,
              legal_client_type: legal?.client_type ?? null,
              legal_payment_form: legal?.payment_form ?? null,
              legal_phone: legal?.phone ?? null,
              legal_email: legal?.email ?? null,
              legal_discount_code: legal?.discount_code ?? null,
              legal_discount_percent: legal?.discount_percent ?? null,
              legal_regional_manager_name: legal?.regional_manager_name ?? null,
              legal_responsible_manager_name: legal?.responsible_manager_name ?? null,
              legal_furniture_manager_name: legal?.furniture_manager_name ?? null,
              legal_furniture_manager_phone: legal?.furniture_manager_phone ?? null,
              legal_ma_number: legal?.ma_number ?? null,
              legal_plan_sum: legal?.plan_sum ?? null,
              legal_plan_retro_bonus: legal?.plan_retro_bonus ?? null,
              legal_parent_1c: legal?.parent_1c ?? null,
              legal_parent_name: null,
              legal_parent_inn: null,
            },
          ] as T[],
        };
      }

      if (sql.includes("COUNT(*)::int AS n FROM exchange_stores_raw WHERE manager_1c")) {
        const managerId = params?.[0] as string;
        const n = stores.filter((s) => s.manager_1c === managerId).length;
        return { rows: [{ n }] as T[] };
      }

      throw new Error(`Unexpected SQL in mock pool: ${sql.slice(0, 120)}`);
    },
  };
}

describe("one-c-showroom-handlers", () => {
  it("JOIN store→legal returns legal fields on store detail", async () => {
    const pool = createMockPool();
    const store = await fetchOneCStore(pool, STORE_ID);
    expect(store).not.toBeNull();
    expect(store?.address).toBe("г. Москва, ул. Тестовая, 1");
    expect(store?.legal_name).toBe("Металлист ООО");
    expect(store?.legal_inn).toBe("7701234567");
    expect(store?.legal_city).toBe("Москва");
    expect(store?.legal_discount_percent).toBe(5);
  });

  it("counts stores per manager", async () => {
    const pool = createMockPool();
    const count = await countStoresForManager(pool, MANAGER_ID);
    expect(count).toBe(2);

    const manager = await fetchOneCManager(pool, MANAGER_ID, "");
    expect(manager).not.toBeNull();
    expect(manager?.user.store_count).toBe(2);
    expect(manager?.stores).toHaveLength(2);
    expect(manager?.stores[0]?.legal_name).toBe("Металлист ООО");
    expect(manager?.stores[0]?.legal_inn).toBe("7701234567");
  });
});
