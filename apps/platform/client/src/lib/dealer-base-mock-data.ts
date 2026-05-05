export type DealerCategory = "TOP" | "A" | "B" | "C";
export type DealerStatus = "активный" | "потенциальный" | "приостановлен" | "требует внимания";
export type DealerFormat = "сетевой" | "одиночный";

export type DealerRow = {
  id: string;
  name: string;
  city: string;
  region: string;
  category: DealerCategory;
  status: DealerStatus;
  format: DealerFormat;
  outlets: number;
  manager: string;
  regionalManager: string;
  lastActivity: string;
  nextAction: string;
  distribution: number;
  showcaseStatus: string;
  hasProblem: boolean;
  comment: string;
  /** Для фильтра «Без активности»: давно нет событий по клиенту */
  hasRecentActivity: boolean;
};

const managers = ["Петров П.П.", "Сидорова С.С.", "Козлов А.А.", "Орлова Е.В.", "Никитин Д.Д."];
const rm = ["Сидорова С.С.", "Волков И.И.", "Морозова Н.Н."];
const cities = ["Краснодар", "Ростов-на-Дону", "Сочи", "Волгоград", "Ставрополь", "Астрахань"];
const statuses: DealerStatus[] = ["активный", "потенциальный", "приостановлен", "требует внимания"];
const categories: DealerCategory[] = ["TOP", "A", "B", "C"];
const formats: DealerFormat[] = ["сетевой", "одиночный"];

function pad(n: number) {
  return String(n).padStart(3, "0");
}

/** 28 обезличенных записей для экрана клиентской базы. */
export const DEALER_BASE_ROWS: DealerRow[] = Array.from({ length: 28 }, (_, i) => {
  const n = i + 1;
  const id = pad(n);
  const city = cities[i % cities.length];
  const status = statuses[i % statuses.length];
  const category = categories[i % categories.length];
  const format = formats[i % 2];
  const distribution = 40 + ((i * 7) % 55);
  const hasProblem = i % 5 === 0 || i % 11 === 3;
  const showcaseOk = distribution >= 55;
  return {
    id,
    name: n <= 8 ? `Дилер №${pad(n)}` : `Клиентская группа №${pad(((n - 1) % 12) + 1)}`,
    city,
    region: "Южный регион",
    category,
    status,
    format,
    outlets: format === "сетевой" ? 2 + (i % 5) : 1,
    manager: managers[i % managers.length],
    regionalManager: rm[i % rm.length],
    lastActivity: `${10 + (i % 18)}.${String((i % 9) + 1).padStart(2, "0")}.2026`,
    nextAction:
      i % 4 === 0
        ? "Звонок по витрине"
        : i % 4 === 1
          ? "Согласовать поставку"
          : i % 4 === 2
            ? "Визит на точку"
            : "Обновить условия",
    distribution,
    showcaseStatus: showcaseOk ? "В норме" : "Доработать",
    hasProblem,
    comment: hasProblem ? "Нужна проверка витрины и контактов" : "Без замечаний",
    hasRecentActivity: i % 7 !== 0,
  };
});
