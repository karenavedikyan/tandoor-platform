/**
 * Streaming SAX parser for 1C exchange stores XML (import_stores/stores1.xml).
 */

import sax from "sax";

export type ExchangeStoreRawRow = {
  id_1c: string;
  name: string;
  address: string | null;
  legal_entity_1c: string | null;
  manager_1c: string | null;
  manager_name: string | null;
  manager_phone: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normUuid(value: string | undefined | null): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  return UUID_RE.test(lower) ? lower : null;
}

function normText(value: string | undefined | null): string {
  return String(value ?? "").trim();
}

type PartialStore = {
  id_1c: string | null;
  name: string;
  address: string | null;
  legal_entity_1c: string | null;
  manager_1c: string | null;
  manager_name: string | null;
  manager_phone: string | null;
};

function emptyStore(): PartialStore {
  return {
    id_1c: null,
    name: "",
    address: null,
    legal_entity_1c: null,
    manager_1c: null,
    manager_name: null,
    manager_phone: null,
  };
}

/**
 * Parse stores XML from a string (streaming via sax).
 */
export async function parseExchangeStoresXml(xml: string): Promise<ExchangeStoreRawRow[]> {
  return new Promise((resolve, reject) => {
    const rows: ExchangeStoreRawRow[] = [];
    const parser = sax.createStream(true, { trim: true, normalize: true });
    let inStoresSection = false;
    let cur: PartialStore | null = null;

    parser.on("opentag", (node) => {
      const tag = node.name;
      if (tag === "ТорговыеТочки") {
        inStoresSection = true;
        return;
      }
      if (!inStoresSection) return;

      if (tag === "ТорговаяТочка") {
        const attrs = node.attributes as Record<string, string>;
        cur = {
          id_1c: normUuid(attrs.Код),
          name: normText(attrs.Наименование),
          address: normText(attrs.Адрес) || null,
          legal_entity_1c: normUuid(attrs.КодКонтрагента),
          manager_1c: null,
          manager_name: null,
          manager_phone: null,
        };
        return;
      }

      if (tag === "Менеджер" && cur) {
        const attrs = node.attributes as Record<string, string>;
        cur.manager_1c = normUuid(attrs.Код);
        cur.manager_name = normText(attrs.ФИО) || null;
        cur.manager_phone = normText(attrs.Телефон) || null;
      }
    });

    parser.on("closetag", (tagName) => {
      if (tagName === "ТорговыеТочки") {
        inStoresSection = false;
        return;
      }
      if (tagName === "ТорговаяТочка" && cur) {
        if (cur.id_1c && cur.name) {
          rows.push({
            id_1c: cur.id_1c,
            name: cur.name,
            address: cur.address,
            legal_entity_1c: cur.legal_entity_1c,
            manager_1c: cur.manager_1c,
            manager_name: cur.manager_name,
            manager_phone: cur.manager_phone,
          });
        }
        cur = null;
      }
    });

    parser.on("error", (e) => {
      reject(e);
    });

    parser.on("end", () => {
      resolve(rows);
    });

    parser.write(xml);
    parser.end();
  });
}

export const SAMPLE_STORES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Данные>
  <ТорговыеТочки>
    <ТорговаяТочка Код="11111111-1111-4111-8111-111111111101" Наименование="Двери Центр" КодКонтрагента="22222222-2222-4222-8222-222222222201" Адрес="Москва, ул. Ленина 1">
      <Менеджер Код="33333333-3333-4333-8333-333333333301" ФИО="Иванов Иван Иваныч" Телефон="79001234567"/>
    </ТорговаяТочка>
    <ТорговаяТочка Код="11111111-1111-4111-8111-111111111102" Наименование="Окна Север" КодКонтрагента="22222222-2222-4222-8222-222222222202" Адрес="СПб, Невский 10"/>
    <ТорговаяТочка Код="11111111-1111-4111-8111-111111111103" Наименование="Фасады" КодКонтрагента="22222222-2222-4222-8222-222222222203" Адрес="Казань, Баумана 5">
      <Менеджер Код="33333333-3333-4333-8333-333333333302" ФИО="Петров Пётр" Телефон="79007654321"/>
    </ТорговаяТочка>
    <ТорговаяТочка Код="11111111-1111-4111-8111-111111111104" Наименование="Склад" КодКонтрагента="22222222-2222-4222-8222-222222222204" Адрес=""/>
    <ТорговаяТочка Код="11111111-1111-4111-8111-111111111105" Наименование="Магазин Юг" КодКонтрагента="22222222-2222-4222-8222-222222222205" Адрес="Ростов, Садовая 3"/>
  </ТорговыеТочки>
</Данные>`;
