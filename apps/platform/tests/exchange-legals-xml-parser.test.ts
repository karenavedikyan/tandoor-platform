import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { PoolLike } from "../server/db/neon-client.js";
import {
  parseExchangeLegalsStream,
  SAMPLE_LEGAL_XML,
  type ExchangeLegalRawRow,
} from "../shared/admin/exchange-legals-xml-parser.js";
import { upsertExchangeLegalsBatch } from "../shared/admin/exchange-legals-handlers.js";

function streamFromString(s: string): Readable {
  return Readable.from([s]);
}

async function collectLegals(xml: string): Promise<ExchangeLegalRawRow[]> {
  const rows: ExchangeLegalRawRow[] = [];
  await parseExchangeLegalsStream(streamFromString(xml), (row) => {
    rows.push(row);
  });
  return rows;
}

describe("parseExchangeLegalsStream", () => {
  it("parses happy path counterparty with managers and discount", async () => {
    const rows = await collectLegals(SAMPLE_LEGAL_XML);
    const main = rows.find((r) => r.id_1c === "11111111-1111-4111-8111-111111111101");
    expect(main).toMatchObject({
      name: "Гуров Александр Валерьевич ИП",
      legal_name: "ИП Гуров",
      inn: "123456789012",
      ma_number: "MA0000052",
      phone: "+79001112233",
      email: "test@example.com",
      discount_code: "2",
      discount_percent: 5.5,
      parent_1c: "22222222-2222-4222-8222-222222222201",
      regional_manager_name: "Региональный Менеджер",
      responsible_manager_name: "Ответственный Менеджер",
      furniture_manager_name: "Фурнитура Внутри",
      plan_retro_bonus: "Нет",
      plan_sum: 1000,
    });
  });

  it("skips duplicate UUID (second occurrence)", async () => {
    const rows = await collectLegals(SAMPLE_LEGAL_XML);
    const dupes = rows.filter((r) => r.id_1c === "11111111-1111-4111-8111-111111111101");
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.name).toBe("Гуров Александр Валерьевич ИП");
  });

  it("skips empty FIO", async () => {
    const rows = await collectLegals(SAMPLE_LEGAL_XML);
    expect(rows.find((r) => r.id_1c === "66666666-6666-4666-8666-666666666601")).toBeUndefined();
  });

  it("parses nested counterparties as separate first-seen rows", async () => {
    const rows = await collectLegals(SAMPLE_LEGAL_XML);
    expect(rows.find((r) => r.id_1c === "77777777-7777-4777-8777-777777777701")).toBeTruthy();
    expect(rows.find((r) => r.id_1c === "88888888-8888-4888-8888-888888888801")).toBeTruthy();
  });

  it("returns total and skipped counts", async () => {
    const result = await parseExchangeLegalsStream(streamFromString(SAMPLE_LEGAL_XML), () => {});
    expect(result.total).toBe(3);
    expect(result.skipped).toBeGreaterThanOrEqual(2);
  });

  it("handles empty discount and NaN plan sum", async () => {
    const xml = `<?xml version="1.0"?><Данные>
      <Контрагент Код="11111111-1111-4111-8111-111111111101" ФИО="Тест" ЮрНаименование="ООО">
        <Скидка/>
        <План РетроБонус="" СуммаПлана="not-a-number"/>
      </Контрагент>
    </Данные>`;
    const rows = await collectLegals(xml);
    expect(rows[0]?.discount_code).toBeNull();
    expect(rows[0]?.discount_percent).toBeNull();
    expect(rows[0]?.plan_sum).toBeNull();
  });

  it("keeps invalid INN as string", async () => {
    const xml = `<?xml version="1.0"?><Данные>
      <Контрагент Код="11111111-1111-4111-8111-111111111101" ФИО="Тест" ИНН="abc"/>
    </Данные>`;
    const rows = await collectLegals(xml);
    expect(rows[0]?.inn).toBe("abc");
  });

  it("parses holding property into parent_1c", async () => {
    const xml = `<?xml version="1.0"?><Данные>
      <Контрагент Код="11111111-1111-4111-8111-111111111101" ФИО="Тест">
        <Свойство Название="КонтрАгентГлавный холдинг" Значение="22222222-2222-4222-8222-222222222201"/>
      </Контрагент>
    </Данные>`;
    const rows = await collectLegals(xml);
    expect(rows[0]?.parent_1c).toBe("22222222-2222-4222-8222-222222222201");
  });

  it("standalone furniture manager under Менеджеры", async () => {
    const xml = `<?xml version="1.0"?><Данные>
      <Контрагент Код="11111111-1111-4111-8111-111111111101" ФИО="Тест">
        <Менеджеры>
          <МенеджерФурнитура Код="55555555-5555-4555-8555-555555555501" ФИО="Фурнитура" Телефон="7900"/>
        </Менеджеры>
      </Контрагент>
    </Данные>`;
    const rows = await collectLegals(xml);
    expect(rows[0]?.furniture_manager_name).toBe("Фурнитура");
  });

  it("empty file yields zero rows", async () => {
    const rows = await collectLegals(`<?xml version="1.0"?><Данные><Контрагенты/></Данные>`);
    expect(rows).toEqual([]);
  });
});

describe("upsertExchangeLegalsBatch", () => {
  it("counts inserted rows", async () => {
    const pool: PoolLike = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT id_1c")) return { rows: [] };
        return { rows: [] };
      }),
    };
    const stats = await upsertExchangeLegalsBatch(
      pool,
      [
        {
          id_1c: "11111111-1111-4111-8111-111111111101",
          name: "Тест",
          legal_name: null,
          inn: null,
          kpp: null,
          ogrn: null,
          ma_number: null,
          payment_form: null,
          region: null,
          city: null,
          client_type: null,
          phone: null,
          email: null,
          discount_code: null,
          discount_percent: null,
          regional_manager_1c: null,
          regional_manager_name: null,
          responsible_manager_1c: null,
          responsible_manager_name: null,
          furniture_manager_1c: null,
          furniture_manager_name: null,
          furniture_manager_phone: null,
          parent_1c: null,
          plan_retro_bonus: null,
          plan_sum: null,
        },
      ],
      "/import_users/users1.xml",
    );
    expect(stats.inserted).toBe(1);
  });
});
