export type DealerCategory = "TOP" | "A" | "B" | "C";
export type DealerStatus = "активный" | "потенциальный" | "приостановлен" | "требует внимания";
export type DealerFormat = "сетевой" | "одиночный";

/** Статус продуктового обучения от Tandoor (мок; далее API). */
export type ProductTrainingStatus = "not_required" | "recommended" | "planned" | "completed";

/** Подборка ИНДИГО для VIP / ключевых партнёров (мок). */
export type IndigoTrainingStatus = "not_required" | "recommended" | "connected" | "in_progress" | "completed";

export type ProductTrainingFields = {
  productTrainingStatus: ProductTrainingStatus;
  productTrainingCompleted: boolean;
  productTrainingCompletedAt?: string;
  productTrainingComment?: string;
};

export type IndigoTrainingFields = {
  indigoTrainingCandidate: boolean;
  indigoTrainingStatus?: IndigoTrainingStatus;
};

export type DealerContacts = {
  lpr: string;
  buyer: string;
  phone: string;
  email: string;
  channel: string;
};

export type DealerTerms = {
  tandoorClub: string;
  special: string;
  payment: string;
  edo: string;
  limit: string;
  bonuses: string;
};

export type DealerSalesKpis = {
  quarterRub: string;
  mkUnits: string;
  vhUnits: string;
  furnitureRub: string;
};

export type DealerDistributionDetail = {
  mk: number;
  vh: number;
  total: number;
  checkDate: string;
};

export type DealerShowcaseDetail = {
  equipment: string;
  todo: string;
  status: string;
  goalLink: string;
};

export type DealerCompetitorsDetail = {
  list: string;
  strengths: string;
  mgrComment: string;
  rmComment: string;
};

export type DealerIssueDetail = {
  summary: string;
  who: string;
  date: string;
  next: string;
  state: string;
};

export type DealerResponsibles = {
  director: string;
  salesManager: string;
  regionalManager: string;
  assistant: string;
};

export type TradePointTask = {
  title: string;
  priority: "Высокий" | "Средний" | "Низкий";
  status: "Новая" | "В работе" | "Запланирована" | "Закрыта";
  due: string;
  assignee: string;
};

export type TradePointActivity = {
  text: string;
  date: string;
};

export type DealerTradePoint = {
  id: string;
  name: string;
  city: string;
  address: string;
  format: string;
  /** Статус торговой точки */
  status: string;
  equipment: string;
  hardwareStockStatus: string;
  doorsStockStatus: string;
  distribution: { mk: number; vh: number; total: number };
  showcaseStatus: string;
  showcaseNeeds: string;
  lastVisitDate: string;
  nextVisitDate: string;
  responsibleRegionalManager: string;
  issues: string;
  tasks: TradePointTask[];
  activityHistory: TradePointActivity[];
  /** Заглушка: вложения фото пока нет */
  photos: { attached: boolean };
} & ProductTrainingFields;

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
  hasRecentActivity: boolean;
  /** Карточка дилера */
  legalEntity: string;
  holding: string;
  tradePoints: DealerTradePoint[];
  responsibles: DealerResponsibles;
  contacts: DealerContacts;
  terms: DealerTerms;
  salesKpis: DealerSalesKpis;
  distributionDetail: DealerDistributionDetail;
  showcase: DealerShowcaseDetail;
  competitors: DealerCompetitorsDetail;
  issues: DealerIssueDetail;
} & ProductTrainingFields & IndigoTrainingFields;

const managers = ["Петров П.П.", "Сидорова С.С.", "Козлов А.А.", "Орлова Е.В.", "Никитин Д.Д."];
const rm = ["Сидорова С.С.", "Волков И.И.", "Морозова Н.Н."];
const cities = ["Краснодар", "Ростов-на-Дону", "Сочи", "Волгоград", "Ставрополь", "Астрахань"];
const statuses: DealerStatus[] = ["активный", "потенциальный", "приостановлен", "требует внимания"];
const categories: DealerCategory[] = ["TOP", "A", "B", "C"];
const formats: DealerFormat[] = ["сетевой", "одиночный"];

function pad(n: number) {
  return String(n).padStart(3, "0");
}

function formatRubFromIndex(i: number) {
  const base = 0.9 + (i % 12) * 0.08;
  return `${base.toFixed(1).replace(".", ",")} млн ₽`;
}

function buildRow(i: number): DealerRow {
  const n = i + 1;
  const id = pad(n);
  const city = cities[i % cities.length];
  const status = statuses[i % statuses.length];
  const category = categories[i % categories.length];
  const format = formats[i % 2];
  const distribution = 40 + ((i * 7) % 55);
  const hasProblem = i % 5 === 0 || i % 11 === 3;
  const dealerTrainingDone = i % 9 === 0;
  const showcaseOk = distribution >= 55;
  const manager = managers[i % managers.length];
  const regional = rm[i % rm.length];
  const mkPct = Math.min(95, 45 + ((i * 5) % 40));
  const vhPct = Math.min(92, 38 + ((i * 3) % 45));
  const totalPct = Math.round((mkPct + vhPct) / 2);
  const holding =
    i % 3 === 0 ? "Группа компаний «Юг»" : i % 3 === 1 ? "Сеть «Юг-Строй»" : "Холдинг «Регион-Маркет»";
  const legalEntity = `ООО «Торговый партнёр ${id}»`;
  const outlets = format === "сетевой" ? 2 + (i % 5) : 1;
  const tradePoints: DealerTradePoint[] = [];
  const pointCount = Math.min(outlets, 3);
  for (let t = 0; t < pointCount; t += 1) {
    const pointSuffix = String(t + 1).padStart(2, "0");
    const pointId = `${id}-${pointSuffix}`;
    const mkAdj = Math.max(38, Math.min(96, mkPct + (t - 1) * 5));
    const vhAdj = Math.max(35, Math.min(94, vhPct + (t - 1) * 4));
    const totalAdj = Math.round((mkAdj + vhAdj) / 2);
    const tpStatuses = ["Активна", "Под наблюдением", "В работе", "На проверке"];
    const hardwareOpts = ["По графику, без задержек", "Частично закрытые позиции", "Пополнение на следующей неделе"];
    const doorsOpts = ["Под заказ, срок согласован", "В наличии на региональном складе", "По заявке менеджера точки"];
    const historyTemplates: TradePointActivity[] = [
      { text: "Проведён визит", date: `${3 + ((i + t) % 12)}.${String(((i + t) % 9) + 1).padStart(2, "0")}.2026` },
      { text: "Обновлена информация по витрине", date: `${7 + ((i + t) % 10)}.${String(((i + t + 1) % 9) + 1).padStart(2, "0")}.2026` },
      { text: "Проверена дистрибуция", date: `${11 + ((i + t) % 8)}.${String(((i + t + 2) % 9) + 1).padStart(2, "0")}.2026` },
      { text: "Добавлен комментарий", date: `${15 + ((i + t) % 7)}.${String(((i + t + 3) % 9) + 1).padStart(2, "0")}.2026` },
    ];
    const taskPool: TradePointTask[] = [
      {
        title: "Проверить выкладку МК",
        priority: "Высокий",
        status: "В работе",
        due: `${18 + ((i + t) % 5)}.05.2026`,
        assignee: regional,
      },
      {
        title: "Согласовать дату следующего визита",
        priority: "Средний",
        status: "Запланирована",
        due: `${22 + ((i + t) % 4)}.05.2026`,
        assignee: manager,
      },
      {
        title: "Обновить фото витрины",
        priority: "Низкий",
        status: "Новая",
        due: `${26 + ((i + t) % 3)}.05.2026`,
        assignee: regional,
      },
      {
        title: "Уточнить складские остатки по дверям",
        priority: "Средний",
        status: "В работе",
        due: `${28 + ((i + t) % 2)}.05.2026`,
        assignee: manager,
      },
    ];
    const taskCount = hasProblem ? 4 : 2 + (t % 2);
    const issuesText = hasProblem
      ? "Требуется контроль витрины и согласование поставки образцов."
      : "Замечаний по точке в текущем цикле нет.";

    const tpWeak = totalAdj < 68 || issuesText.toLowerCase().includes("витрин");
    const tpTrainingDone = t === 0 && (i + t * 3) % 14 === 0;
    tradePoints.push({
      id: pointId,
      name: `Торговая точка №${t + 1}`,
      city,
      address: `г. ${city}, торговая точка №${t + 1}`,
      format: t === 0 ? "Монобрендовый салон" : "Фирменный отдел",
      status: tpStatuses[(i + t) % tpStatuses.length],
      equipment: t === 0 ? "Стенд МК, образцы ВХ" : "Стенд МК",
      hardwareStockStatus: hardwareOpts[(i + t) % hardwareOpts.length],
      doorsStockStatus: doorsOpts[(i + t * 2) % doorsOpts.length],
      distribution: { mk: mkAdj, vh: vhAdj, total: totalAdj },
      showcaseStatus: `${55 + ((i + t * 3) % 40)}% — ${showcaseOk ? "в норме" : "нужны доработки"}`,
      showcaseNeeds: t === 0 ? "Дополнительные образцы фурнитуры" : "Актуализация ценников на стенде",
      lastVisitDate: `${2 + ((i + t) % 14)}.${String(((i + t) % 9) + 1).padStart(2, "0")}.2026`,
      nextVisitDate: `${24 + ((i + t) % 6)}.${String(((i + t + 1) % 9) + 1).padStart(2, "0")}.2026`,
      responsibleRegionalManager: regional,
      issues: issuesText,
      tasks: taskPool.slice(0, taskCount),
      activityHistory: historyTemplates,
      photos: { attached: false },
      productTrainingCompleted: tpTrainingDone,
      productTrainingCompletedAt: tpTrainingDone ? `${4 + (t % 5)}.04.2026` : undefined,
      productTrainingComment: tpTrainingDone ? "Короткий инструктаж на точке." : undefined,
      productTrainingStatus: tpTrainingDone
        ? "completed"
        : tpWeak && t === 0
          ? "recommended"
          : tpWeak
            ? "planned"
            : "not_required",
    });
  }
  const competitorSets = [
    "Конкурент A, Конкурент B, Конкурент C",
    "Конкурент D, Конкурент E",
    "Конкурент F, Конкурент G, Конкурент H",
  ];
  const strengthSets = [
    "Цена на ВХ, быстрые поставки",
    "Широкая сеть точек",
    "Агрессивные акции на входные группы",
  ];

  return {
    id,
    name: n <= 8 ? `Дилер №${pad(n)}` : `Клиентская группа №${pad(((n - 1) % 12) + 1)}`,
    city,
    region: "Южный регион",
    category,
    status,
    format,
    outlets,
    manager,
    regionalManager: regional,
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
    legalEntity,
    holding,
    tradePoints,
    responsibles: {
      director: "Иванов И.И.",
      salesManager: manager,
      regionalManager: regional,
      assistant: "Кузнецова К.К.",
    },
    contacts: {
      lpr: "Директор точки",
      buyer: "Закупщик",
      phone: "+7 XXX XXX-XX-XX",
      email: `office-${id}@company.test`,
      channel: "Электронная почта и мессенджер",
    },
    terms: {
      tandoorClub: i % 2 === 0 ? "Участник" : "Кандидат",
      special: "Индивидуальная скидка по согласованию",
      payment: `${7 + (i % 14)} дней отсрочки`,
      edo: i % 2 === 0 ? "Диадок" : "СБИС",
      limit: `${1.5 + (i % 8) * 0.25} млн ₽`,
      bonuses: i % 3 === 0 ? "Квартальная программа" : "Мотивация торгового зала",
    },
    salesKpis: {
      quarterRub: formatRubFromIndex(i),
      mkUnits: String(120 + (i * 13) % 400),
      vhUnits: String(80 + (i * 7) % 220),
      furnitureRub: `${80 + (i % 12) * 15} тыс. ₽`,
    },
    distributionDetail: {
      mk: mkPct,
      vh: vhPct,
      total: totalPct,
      checkDate: `${8 + (i % 20)}.${String((i % 11) + 1).padStart(2, "0")}.2026`,
    },
    showcase: {
      equipment: `Стенд МК, план ВХ Q${1 + (i % 4)}`,
      todo: i % 4 === 0 ? "Доп. образцы фурнитуры" : "Обновить ценники на стенде",
      status: `${60 + (i % 35)}% готовности`,
      goalLink: `Цель по МК — квартал ${1 + (i % 2)}`,
    },
    competitors: {
      list: competitorSets[i % competitorSets.length],
      strengths: strengthSets[i % strengthSets.length],
      mgrComment: `Позиция по МК: ${i % 2 === 0 ? "стабильно" : "усилить"}`,
      rmComment: i % 3 === 0 ? "Запланирован визит для фото витрины" : "Контроль выкладки на следующей неделе",
    },
    issues: {
      summary: hasProblem
        ? "Нужна проверка полноты витрины и актуальности контактов"
        : "Замечаний по текущему циклу нет",
      who: regional,
      date: `${20 + (i % 8)}.${String((i % 9) + 1).padStart(2, "0")}.2026`,
      next: i % 2 === 0 ? "Визит и обновление карточки" : "Согласование плана работ",
      state: hasProblem ? "В работе" : "Закрыто",
    },
    productTrainingCompleted: dealerTrainingDone,
    productTrainingCompletedAt: dealerTrainingDone ? `${2 + (i % 6)}.03.2026` : undefined,
    productTrainingComment: dealerTrainingDone ? "Выездной блок по МК и фурнитуре." : undefined,
    productTrainingStatus: dealerTrainingDone
      ? "completed"
      : category === "TOP" || category === "A"
        ? "recommended"
        : category === "B" && totalPct < 58
          ? "planned"
          : "not_required",
    indigoTrainingCandidate: category === "TOP" || (category === "A" && outlets >= 3),
    indigoTrainingStatus:
      category === "TOP"
        ? "recommended"
        : category === "A" && outlets >= 3
          ? "recommended"
          : "not_required",
  };
}

/** 28 обезличенных записей для экрана клиентской базы и карточек. */
export const DEALER_BASE_ROWS: DealerRow[] = Array.from({ length: 28 }, (_, i) => buildRow(i));

export function normalizeDealerId(raw: string): string {
  const t = raw.trim();
  if (/^\d{1,3}$/.test(t)) {
    return pad(parseInt(t, 10));
  }
  return t;
}

export function getDealerById(rawId: string): DealerRow | undefined {
  const id = normalizeDealerId(rawId);
  return DEALER_BASE_ROWS.find((r) => r.id === id);
}

/** Нормализует id точки вида `001-1` → `001-01` для дилера `001`. */
export function normalizeTradePointId(dealerPaddedId: string, rawPointId: string): string {
  const d = normalizeDealerId(dealerPaddedId);
  const t = rawPointId.trim();
  const m = t.match(/^(\d{3})-(\d{1,3})$/);
  if (m && m[1] === d) {
    return `${d}-${String(parseInt(m[2], 10)).padStart(2, "0")}`;
  }
  if (/^\d{3}-\d{2}$/.test(t)) return t;
  return t;
}

export function getTradePointByIds(
  rawDealerId: string,
  rawPointId: string,
): { dealer: DealerRow; point: DealerTradePoint } | undefined {
  const dealer = getDealerById(rawDealerId);
  if (!dealer) return undefined;
  const normalizedPoint = normalizeTradePointId(dealer.id, rawPointId);
  const point = dealer.tradePoints.find((p) => p.id === normalizedPoint);
  if (!point) return undefined;
  return { dealer, point };
}
