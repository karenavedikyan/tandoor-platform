import { CATALOG_PRODUCTS } from "@/lib/catalog-data";
import type { MarketingBriefBlockType } from "@/lib/marketing-briefs-api";

export type TemplateBlock = {
  type: MarketingBriefBlockType;
  payload: Record<string, unknown>;
};

function pickProducts(n: number) {
  const items = CATALOG_PRODUCTS.slice(0, n).map((p, idx) => ({
    id: `tmpl-prod-${idx + 1}`,
    catalog_id: p.id,
    manual: false,
    name: p.name,
    article: p.article,
    image_url: p.image ?? undefined,
    segments: ["top150", "top350"] as const,
    price_showroom: null,
    price_retail: p.priceRetailRub ?? null,
  }));
  if (items.length > 0) return items;
  return Array.from({ length: n }).map((_, idx) => ({
    id: `tmpl-prod-${idx + 1}`,
    catalog_id: null,
    manual: true,
    name: `Модель ${idx + 1}`,
    article: `ART-00${idx + 1}`,
    image_url: undefined,
    segments: ["top150"] as const,
    price_showroom: 30000,
    price_retail: 45000,
  }));
}

export const TEMPLATE_BLOCKS: TemplateBlock[] = [
  {
    type: "section",
    payload: {
      number: "01",
      title: "Условия выставления",
      subtitle: "Скидки и территории",
    },
  },
  {
    type: "text",
    payload: {
      heading: "Скидки по сегментам клиентов",
      body:
        "СКИДКА до 40% для клиентов, входящих в ТОП-350.\n" +
        "СКИДКА до 30% для клиентов, входящих в ТОП-500 (есть исключения по моделям — смотри ниже).\n" +
        "СКИДКА до 20% для клиентов 500+ (есть исключения по моделям).\n\n" +
        "Максимальная скидка на входные двери свыше 49 000 ₽ — 30% для клиентов ТОП-150. Возможно выставление с большим процентом скидки по согласованию с руководителем.\n\n" +
        "Максимальная скидка на модели Teos / Амулет / Плаза — 20%.\n\n" +
        "Территориальные ограничения по выставлению витрин сняты. С марта можно выставлять на любой территории нашего присутствия.",
    },
  },
  {
    type: "segments",
    payload: {
      heading: "Условия по сегментам ТОП",
      segments: {
        top150: "Скидка до 40%.\nМаксимальная скидка на входные двери > 49 000 ₽ — 30%.\nПо согласованию с руководителем — больше.",
        top350: "Скидка до 30%.\nИсключения по моделям — см. список.",
        top500: "Скидка до 20%.\nИсключения по моделям — см. список.",
        top500plus: "Скидка до 20%.\nИндивидуально по согласованию.",
      },
    },
  },
  {
    type: "callout",
    payload: {
      tone: "warning",
      heading: "ВАЖНО",
      body:
        "Модели Teos / Амулет / Плаза — максимальная скидка 20%.\n" +
        "На второй план скидка не предоставляется.\n" +
        "Двусторонние образцы 400/4/6/8 — выставляются по 1 500 ₽ только в июне и только для ТОП-150 и ТОП-350.",
    },
  },
  {
    type: "products",
    payload: {
      heading: "Что выставлять",
      items: pickProducts(4),
    },
  },
  {
    type: "price_table",
    payload: {
      heading: "Акции июня",
      show_benefit: true,
      rows: [
        { id: "tmpl-row-1", model: "Пантеон Букле тёмно-серый", price_old: 36450, price_new: 30460 },
        { id: "tmpl-row-2", model: "Амулет Чёрный кварц", price_old: 42900, price_new: 34320 },
        { id: "tmpl-row-3", model: "Teos Графит", price_old: 51500, price_new: 41200 },
      ],
    },
  },
  {
    type: "bonus",
    payload: {
      heading: "БОНУС ЗА ПРОДАЖУ",
      items: [
        {
          id: "tmpl-bonus-1",
          trigger: "За продажу входных дверей",
          reward: "1 000 ₽ за каждую дверь",
          audience: "Менеджер",
          conditions: "От 10 шт за месяц",
          valid_until: "2026-06-30",
          require_photo_report: true,
        },
        {
          id: "tmpl-bonus-2",
          trigger: "За продажу межкомнатных серий VIP",
          reward: "5% от суммы продажи",
          audience: "Менеджер + ТП",
          conditions: "Только для ТОП-150 / ТОП-350",
          valid_until: "2026-06-30",
          require_photo_report: false,
        },
      ],
    },
  },
];
