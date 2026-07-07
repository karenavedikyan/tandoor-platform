import { describe, expect, it, vi } from "vitest";
import type { PoolLike } from "../server/db/neon-client.js";
import {
  parseExchangeUsersXml,
  SAMPLE_USERS_XML,
} from "../shared/admin/exchange-users-xml-parser.js";
import { upsertExchangeUsersBatch } from "../shared/admin/exchange-users-handlers.js";

describe("parseExchangeUsersXml", () => {
  it("parses valid employees", async () => {
    const rows = await parseExchangeUsersXml(SAMPLE_USERS_XML);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id_1c: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001",
      name: "Иванов И.И. (дубликат)",
      phone: "79001111111",
    });
    expect(rows[1]?.name).toBe("Петров Пётр");
  });

  it("skips invalid UUID and empty FIO", async () => {
    const rows = await parseExchangeUsersXml(SAMPLE_USERS_XML);
    expect(rows.find((r) => r.name.includes("Битый"))).toBeUndefined();
    expect(rows.find((r) => r.id_1c === "cccccccc-cccc-4ccc-8ccc-cccccccc0003")).toBeUndefined();
  });

  it("returns empty array for empty xml", async () => {
    const rows = await parseExchangeUsersXml(`<?xml version="1.0"?><Данные><Сотрудники/></Данные>`);
    expect(rows).toEqual([]);
  });

  it("happy path single employee", async () => {
    const xml = `<?xml version="1.0"?><Данные><Сотрудник Код="11111111-1111-4111-8111-111111111101" ФИО="Тест" Телефон="7900"/></Данные>`;
    const rows = await parseExchangeUsersXml(xml);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.phone).toBe("7900");
  });

  it("duplicate UUID keeps last row", async () => {
    const xml = `<?xml version="1.0"?><Данные>
      <Сотрудник Код="11111111-1111-4111-8111-111111111101" ФИО="Первый"/>
      <Сотрудник Код="11111111-1111-4111-8111-111111111101" ФИО="Второй"/>
    </Данные>`;
    const rows = await parseExchangeUsersXml(xml);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Второй");
  });
});

describe("upsertExchangeUsersBatch", () => {
  it("counts inserted and updated", async () => {
    const pool: PoolLike = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT id_1c")) {
          return {
            rows: [
              {
                id_1c: "11111111-1111-4111-8111-111111111101",
                name: "Старое",
                phone: null,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const stats = await upsertExchangeUsersBatch(
      pool,
      [
        { id_1c: "11111111-1111-4111-8111-111111111101", name: "Новое", phone: "7900" },
        { id_1c: "22222222-2222-4222-8222-222222222201", name: "Новый", phone: null },
      ],
      "/import_users/employers1.xml",
    );
    expect(stats).toEqual({ inserted: 1, updated: 1, unchanged: 0 });
  });
});
