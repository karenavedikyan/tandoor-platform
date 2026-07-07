/**
 * Streaming SAX parser for 1C exchange users XML (import_users/employers1.xml).
 */

import sax from "sax";
import { normPhone, normText, normUuid } from "./exchange-uuid.js";

export type ExchangeUserRawRow = {
  id_1c: string;
  name: string;
  phone: string | null;
};

export async function parseExchangeUsersXml(xml: string): Promise<ExchangeUserRawRow[]> {
  return new Promise((resolve, reject) => {
    const byId = new Map<string, ExchangeUserRawRow>();
    const parser = sax.createStream(true, { trim: true, normalize: true });

    parser.on("opentag", (node) => {
      if (node.name !== "Сотрудник") return;
      const attrs = node.attributes as Record<string, string>;
      const id_1c = normUuid(attrs.Код);
      const name = normText(attrs.ФИО);
      if (!id_1c || !name) return;
      byId.set(id_1c, {
        id_1c,
        name,
        phone: normPhone(attrs.Телефон),
      });
    });

    parser.on("error", reject);
    parser.on("end", () => resolve([...Array.from(byId.values())]));

    parser.write(xml);
    parser.end();
  });
}

export const SAMPLE_USERS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Данные>
  <Сотрудники>
    <Сотрудник Код="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001" ФИО="Иванов Иван Иванович" Телефон="79001234567"/>
    <Сотрудник Код="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002" ФИО="Петров Пётр" Телефон="+7 900 765-43-21"/>
    <Сотрудник Код="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001" ФИО="Иванов И.И. (дубликат)" Телефон="79001111111"/>
    <Сотрудник Код="not-a-uuid" ФИО="Битый UUID"/>
    <Сотрудник Код="cccccccc-cccc-4ccc-8ccc-cccccccc0003" ФИО=""/>
  </Сотрудники>
</Данные>`;
