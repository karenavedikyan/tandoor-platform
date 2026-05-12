export type MarketingBriefStatus = "draft" | "published";

export type MarketingBrief = {
  id: string;
  month: string;
  title: string;
  text: string;
  /** JSON string: string[][] для простой таблицы */
  tableJson: string;
  imageUrl: string;
  status: MarketingBriefStatus;
  updatedAt: string;
};

const STORAGE_KEY = "tandoor-marketing-briefs-v1";

export function defaultTableJson(): string {
  return JSON.stringify([
    ["Показатель", "План", "Факт"],
    ["Визиты", "120", "98"],
    ["Новые ТТ", "8", "5"],
  ]);
}

export function seedMarketingBriefs(): MarketingBrief[] {
  const now = new Date().toISOString();
  return [
    {
      id: "mb-2026-05-1",
      month: "2026-05",
      title: "Май: фокус на витрине ВХ и фурнитуре",
      text: "Команда, в мае усиливаем демонстрацию входных групп и крепим связку «дверь + фурнитура». Просьба зафиксировать в CRM фото витрин после визита.",
      tableJson: defaultTableJson(),
      imageUrl: "",
      status: "published",
      updatedAt: now,
    },
    {
      id: "mb-2026-06-1",
      month: "2026-06",
      title: "Июнь: подготовка к сезону",
      text: "Черновик: добавить акценты по МК и обучению персонала в ТОП-точках.",
      tableJson: defaultTableJson(),
      imageUrl: "https://tandoor.ru/local/templates/tandoor/images/logo.svg",
      status: "draft",
      updatedAt: now,
    },
  ];
}

export function loadMarketingBriefs(): MarketingBrief[] {
  if (typeof window === "undefined" || !window.sessionStorage) return seedMarketingBriefs();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return seedMarketingBriefs();
    const parsed = JSON.parse(raw) as MarketingBrief[];
    return Array.isArray(parsed) && parsed.length ? parsed : seedMarketingBriefs();
  } catch {
    return seedMarketingBriefs();
  }
}

export function saveMarketingBriefs(list: MarketingBrief[]): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function newBriefId(): string {
  return `mb-${Date.now()}`;
}

export function parseTable(json: string): string[][] {
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [["Ошибка", "Проверьте JSON", ""]];
    return v.map((row) => (Array.isArray(row) ? row.map((c) => String(c)) : [String(row)]));
  } catch {
    return [["Ошибка", "Некорректный JSON таблицы", ""]];
  }
}
