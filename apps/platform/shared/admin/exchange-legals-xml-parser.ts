/**
 * Streaming SAX parser for 1C exchange legals XML (import_users/users1.xml).
 * Does not load the full file into memory — works from a Node Readable stream.
 */

import type { Readable } from "node:stream";
import sax from "sax";
import { normText, normUuid, parseOptionalFloat } from "./exchange-uuid.js";

export type ExchangeLegalRawRow = {
  id_1c: string;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  ma_number: string | null;
  payment_form: string | null;
  region: string | null;
  city: string | null;
  client_type: string | null;
  phone: string | null;
  email: string | null;
  discount_code: string | null;
  discount_percent: number | null;
  regional_manager_1c: string | null;
  regional_manager_name: string | null;
  responsible_manager_1c: string | null;
  responsible_manager_name: string | null;
  furniture_manager_1c: string | null;
  furniture_manager_name: string | null;
  furniture_manager_phone: string | null;
  parent_1c: string | null;
  plan_retro_bonus: string | null;
  plan_sum: number | null;
};

type PartialLegal = {
  id_1c: string | null;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  ma_number: string | null;
  payment_form: string | null;
  region: string | null;
  city: string | null;
  client_type: string | null;
  phone: string | null;
  email: string | null;
  discount_code: string | null;
  discount_percent: number | null;
  regional_manager_1c: string | null;
  regional_manager_name: string | null;
  responsible_manager_1c: string | null;
  responsible_manager_name: string | null;
  furniture_manager_1c: string | null;
  furniture_manager_name: string | null;
  furniture_manager_phone: string | null;
  parent_1c: string | null;
  plan_retro_bonus: string | null;
  plan_sum: number | null;
};

function emptyLegal(attrs: Record<string, string> = {}): PartialLegal {
  return {
    id_1c: normUuid(attrs.Код),
    name: normText(attrs.ФИО),
    legal_name: normText(attrs.ЮрНаименование) || null,
    inn: normText(attrs.ИНН) || null,
    kpp: normText(attrs.КПП) || null,
    ogrn: normText(attrs.ОГРН) || null,
    ma_number: normText(attrs.Номер) || null,
    payment_form: normText(attrs.ВидОплаты) || null,
    region: normText(attrs.КрайГород) || null,
    city: normText(attrs.НаселенныйПункт) || null,
    client_type: normText(attrs.ТипКлиента) || null,
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
  };
}

function finalizeRow(partial: PartialLegal): ExchangeLegalRawRow | null {
  if (!partial.id_1c || !partial.name) return null;
  return {
    id_1c: partial.id_1c,
    name: partial.name,
    legal_name: partial.legal_name,
    inn: partial.inn,
    kpp: partial.kpp,
    ogrn: partial.ogrn,
    ma_number: partial.ma_number,
    payment_form: partial.payment_form,
    region: partial.region,
    city: partial.city,
    client_type: partial.client_type,
    phone: partial.phone,
    email: partial.email,
    discount_code: partial.discount_code,
    discount_percent: partial.discount_percent,
    regional_manager_1c: partial.regional_manager_1c,
    regional_manager_name: partial.regional_manager_name,
    responsible_manager_1c: partial.responsible_manager_1c,
    responsible_manager_name: partial.responsible_manager_name,
    furniture_manager_1c: partial.furniture_manager_1c,
    furniture_manager_name: partial.furniture_manager_name,
    furniture_manager_phone: partial.furniture_manager_phone,
    parent_1c: partial.parent_1c,
    plan_retro_bonus: partial.plan_retro_bonus,
    plan_sum: partial.plan_sum,
  };
}

function isHoldingProperty(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("контрагентглавный") || n.includes("холдинг");
}

export function parseExchangeLegalsStream(
  input: Readable,
  onRow: (row: ExchangeLegalRawRow) => void | Promise<void>,
): Promise<{ total: number; skipped: number }> {
  return new Promise((resolve, reject) => {
    const seen = new Set<string>();
    let total = 0;
    let skipped = 0;
    const stack: PartialLegal[] = [];
    let textTag: "Телефон" | "email" | null = null;
    let textBuf = "";
    let inManagers = 0;
    let inResponsible = 0;

    const parser = sax.createStream(true, { trim: true, normalize: true });

    let processing = Promise.resolve();

    parser.on("opentag", (node) => {
      const tag = node.name;
      const attrs = node.attributes as Record<string, string>;

      if (tag === "Контрагент") {
        stack.push(emptyLegal(attrs));
        textTag = null;
        textBuf = "";
        return;
      }

      const cur = stack[stack.length - 1];
      if (!cur) return;

      if (tag === "Телефон" || tag === "email") {
        textTag = tag;
        textBuf = "";
        return;
      }

      if (tag === "Скидка") {
        cur.discount_code = normText(attrs.Код) || null;
        cur.discount_percent = parseOptionalFloat(attrs.Размер);
        return;
      }

      if (tag === "План") {
        cur.plan_retro_bonus = normText(attrs.РетроБонус) || null;
        cur.plan_sum = parseOptionalFloat(attrs.СуммаПлана);
        return;
      }

      if (tag === "Свойство") {
        const propName = normText(attrs.Название);
        if (propName && isHoldingProperty(propName)) {
          const parent = normUuid(attrs.Значение);
          if (parent) cur.parent_1c = parent;
        }
        return;
      }

      if (tag === "Менеджеры") {
        inManagers += 1;
        return;
      }

      if (tag === "Региональный" && inManagers > 0) {
        cur.regional_manager_1c = normUuid(attrs.Код);
        cur.regional_manager_name = normText(attrs.ФИО) || null;
        return;
      }

      if (tag === "Ответственный" && inManagers > 0) {
        inResponsible += 1;
        cur.responsible_manager_1c = normUuid(attrs.Код);
        cur.responsible_manager_name = normText(attrs.ФИО) || null;
        return;
      }

      if (tag === "МенеджерФурнитура" && inManagers > 0) {
        if (!cur.furniture_manager_1c) {
          cur.furniture_manager_1c = normUuid(attrs.Код);
          cur.furniture_manager_name = normText(attrs.ФИО) || null;
          cur.furniture_manager_phone = normText(attrs.Телефон) || null;
        }
      }
    });

    parser.on("text", (text: string) => {
      if (textTag) textBuf += text;
    });

    parser.on("closetag", (tagName) => {
      if (tagName === "Телефон" || tagName === "email") {
        const cur = stack[stack.length - 1];
        if (cur && textTag === tagName) {
          const v = normText(textBuf);
          if (v) {
            if (tagName === "Телефон") cur.phone = v;
            else cur.email = v;
          }
          textTag = null;
          textBuf = "";
        }
        return;
      }

      if (tagName === "Ответственный") {
        inResponsible = Math.max(0, inResponsible - 1);
        return;
      }

      if (tagName === "Менеджеры") {
        inManagers = Math.max(0, inManagers - 1);
        return;
      }

      if (tagName === "Контрагент") {
        const closed = stack.pop();
        processing = processing.then(async () => {
          if (!closed) return;
          const row = finalizeRow(closed);
          if (!row) {
            skipped += 1;
            return;
          }
          if (seen.has(row.id_1c)) {
            skipped += 1;
            return;
          }
          seen.add(row.id_1c);
          try {
            await onRow(row);
            total += 1;
          } catch (e) {
            reject(e);
            throw e;
          }
        });
        return;
      }
    });

    parser.on("error", reject);
    parser.on("end", () => {
      processing.then(() => resolve({ total, skipped })).catch(reject);
    });

    input.pipe(parser as unknown as NodeJS.WritableStream);
  });
}

export const SAMPLE_LEGAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Данные>
  <Контрагенты>
    <Контрагент Код="11111111-1111-4111-8111-111111111101" ФИО="Гуров Александр Валерьевич ИП" ЮрНаименование="ИП Гуров" ИНН="123456789012" КПП="" ОГРН="123" Номер="MA0000052" ВидОплаты="Безнал" КрайГород="Краснодарский" НаселенныйПункт="Краснодар" ТипКлиента="ТОП-500">
      <Телефон>+79001112233</Телефон>
      <email>test@example.com</email>
      <Скидка Код="2" Размер="5.5"/>
      <План РетроБонус="Нет" СуммаПлана="1000"/>
      <Свойство Название="КонтрАгентГлавный( Холдинг 1с)" Значение="22222222-2222-4222-8222-222222222201"/>
      <Менеджеры>
        <Региональный Код="33333333-3333-4333-8333-333333333301" ФИО="Региональный Менеджер"/>
        <Ответственный Код="44444444-4444-4444-8444-444444444401" ФИО="Ответственный Менеджер">
          <МенеджерФурнитура Код="55555555-5555-4555-8555-555555555501" ФИО="Фурнитура Внутри" Телефон="79003334455"/>
        </Ответственный>
      </Менеджеры>
    </Контрагент>
    <Контрагент Код="11111111-1111-4111-8111-111111111101" ФИО="Дубликат" ЮрНаименование="Не должен попасть"/>
    <Контрагент Код="66666666-6666-4666-8666-666666666601" ФИО="" ЮрНаименование="Пустое ФИО"/>
    <Контрагент Код="77777777-7777-4777-8777-777777777701" ФИО="Вложенный холдинг" ЮрНаименование="ООО Вложенный">
      <Контрагент Код="88888888-8888-4888-8888-888888888801" ФИО="Дочерний контрагент" ЮрНаименование="ООО Дочка"/>
    </Контрагент>
  </Контрагенты>
</Данные>`;
