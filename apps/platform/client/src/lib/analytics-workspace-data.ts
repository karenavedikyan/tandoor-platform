/**
 * Аналитика команды (Release 1): ручной ввод / mock, без 1С.
 */

export type AnalyticsWorkspaceTabId =
  | "top500"
  | "500plus"
  | "club"
  | "showcase-profitability"
  | "hardware-conversion"
  | "equipment"
  | "equipment-documents"
  | "summary";

export type AnalyticsWorkspaceRow = {
  id: string;
  manager: string;
  client: string;
  clientCategory: string;
  city: string;
  v1: string;
  v2: string;
  v3: string;
};

const STORAGE_KEY = "tandoor-analytics-workspace-v1";

const MANAGERS = ["Антон И.", "Олег П.", "Ксения С.", "Павел К.", "Марина В."];
const CLIENTS = ["ООО «СеверСтрой»", "ИП Крылов", "ТД «Витраж»", "ООО «Двери Юг»", "Холдинг «Лайм»"];
const CATS = ["TOP", "Стандарт", "Потенциальный", "TOP", "Стандарт"];
const CITIES = ["Ростов-на-Дону", "Краснодар", "Воронеж", "Ставрополь", "Волгоград"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seedRow(tab: AnalyticsWorkspaceTabId, i: number): AnalyticsWorkspaceRow {
  const id = `${tab}-${i}`;
  const h = hash(`${tab}|${i}`);
  const manager = MANAGERS[h % MANAGERS.length];
  const client = CLIENTS[(h >> 3) % CLIENTS.length];
  const clientCategory = CATS[(h >> 5) % CATS.length];
  const city = CITIES[(h >> 7) % CITIES.length];
  const n = (x: number) => String(x);
  switch (tab) {
    case "top500":
      return { id, manager, client, clientCategory, city, v1: n(800_000 + (h % 200) * 10_000), v2: n(20 + (h % 80)), v3: n(10 + (h % 40)) };
    case "500plus":
      return { id, manager, client, clientCategory, city, v1: n(120 + (h % 200)), v2: n(5 + (h % 15)), v3: n(1 + (h % 4)) };
    case "club":
      return { id, manager, client, clientCategory, city, v1: h % 2 ? "Gold" : "Silver", v2: n(3_200_000 + (h % 50) * 80_000), v3: n(40 + (h % 40)) + "%" };
    case "showcase-profitability":
      return { id, manager, client, clientCategory, city, v1: h % 3 ? "ВХ витрина" : "МК зона", v2: n(18 + (h % 25)) + "%", v3: n(120_000 + (h % 30) * 4000) };
    case "hardware-conversion":
      return { id, manager, client, clientCategory, city, v1: n(12 + (h % 40)) + "%", v2: n(450_000 + (h % 20) * 25_000), v3: n(2 + (h % 8)) };
    case "equipment":
      return { id, manager, client, clientCategory, city, v1: ["Согласование", "Поставка", "Монтаж"][h % 3], v2: n(1_200_000 + (h % 15) * 90_000), v3: n(1 + (h % 5)) };
    case "equipment-documents":
      return { id, manager, client, clientCategory, city, v1: ["Договор", "Спецификация", "Акт"][h % 3], v2: `2026-0${1 + (h % 5)}-${10 + (h % 18)}`, v3: h % 2 ? "Подписано" : "На подписи" };
    default:
      return { id, manager, client, clientCategory, city, v1: "—", v2: "—", v3: "—" };
  }
}

export function seedRowsForTab(tab: AnalyticsWorkspaceTabId): AnalyticsWorkspaceRow[] {
  if (tab === "summary") {
    return [
      {
        id: "summary-1",
        manager: "—",
        client: "—",
        clientCategory: "—",
        city: "—",
        v1: "Активные клиенты ТОП",
        v2: "128",
        v3: "Ручной показатель",
      },
      {
        id: "summary-2",
        manager: "—",
        client: "—",
        clientCategory: "—",
        city: "—",
        v1: "Средний чек фурнитуры, ₽",
        v2: "186 400",
        v3: "Оценка отдела",
      },
      {
        id: "summary-3",
        manager: "—",
        client: "—",
        clientCategory: "—",
        city: "—",
        v1: "Договоров по оборудованию в работе",
        v2: "34",
        v3: "Без 1С",
      },
      {
        id: "summary-4",
        manager: "—",
        client: "—",
        clientCategory: "—",
        city: "—",
        v1: "Конверсия визит → заказ (фурнитура)",
        v2: "19%",
        v3: "По полю «Конверсия» вкладки",
      },
    ];
  }
  return Array.from({ length: 14 }, (_, i) => seedRow(tab, i));
}

export type AnalyticsWorkspaceStore = {
  tabs: Partial<Record<AnalyticsWorkspaceTabId, AnalyticsWorkspaceRow[]>>;
};

export function loadAnalyticsWorkspaceStore(): AnalyticsWorkspaceStore {
  if (typeof window === "undefined" || !window.sessionStorage) return { tabs: {} };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { tabs: {} };
    return JSON.parse(raw) as AnalyticsWorkspaceStore;
  } catch {
    return { tabs: {} };
  }
}

export function saveAnalyticsWorkspaceStore(store: AnalyticsWorkspaceStore): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getRowsForTab(tab: AnalyticsWorkspaceTabId): AnalyticsWorkspaceRow[] {
  const store = loadAnalyticsWorkspaceStore();
  const saved = store.tabs[tab];
  if (saved && saved.length) return saved;
  return seedRowsForTab(tab);
}

export const ANALYTICS_WORKSPACE_TAB_META: {
  id: AnalyticsWorkspaceTabId;
  label: string;
  testId: string;
  h1: string;
  h2: string;
  h3: string;
}[] = [
  { id: "top500", label: "ТОП 500", testId: "tab-analytics-top500", h1: "Оборот, ₽", h2: "ВХ, шт.", h3: "МК, шт." },
  { id: "500plus", label: "500+", testId: "tab-analytics-500plus", h1: "Клиентов в сегменте", h2: "Активных ТТ", h3: "Новых договоров" },
  { id: "club", label: "Tandoor Club", testId: "tab-analytics-club", h1: "Уровень", h2: "Оборот, ₽", h3: "Доля фурнитуры" },
  {
    id: "showcase-profitability",
    label: "Рентабельность витрин",
    testId: "tab-analytics-showcase-profitability",
    h1: "Тип витрины",
    h2: "Маржа, %",
    h3: "Вклад, ₽",
  },
  {
    id: "hardware-conversion",
    label: "Конверсия фурнитуры",
    testId: "tab-analytics-hardware-conversion",
    h1: "Конверсия, %",
    h2: "Оборот фурнитуры, ₽",
    h3: "Сделок",
  },
  { id: "equipment", label: "Оборудование", testId: "tab-analytics-equipment", h1: "Этап", h2: "Сумма, ₽", h3: "Единиц" },
  {
    id: "equipment-documents",
    label: "Договоры/документы по оборудованию",
    testId: "tab-analytics-equipment-documents",
    h1: "Тип документа",
    h2: "Дата",
    h3: "Статус",
  },
  { id: "summary", label: "Сводка", testId: "tab-analytics-summary", h1: "Показатель", h2: "Значение", h3: "Комментарий" },
];
