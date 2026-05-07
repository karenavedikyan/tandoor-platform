/**
 * Дорожная карта наполнения обучения из корпоративной Wiki (вторая волна и далее).
 * Только классификация и безопасные аннотации — без полного wikitext, закрытых URL и секретов.
 */

import type { TrainingSectionKey } from "./training-data";

export type WikiTrainingPriority = "P0" | "P1" | "P2";

export type WikiTrainingAudience = "sales_manager" | "regional_manager" | "lead" | "new_employee";

export type WikiTrainingProductScope = "mk" | "vh" | "hardware" | "all" | "none";

export type WikiTrainingWorkContext =
  | "catalog"
  | "dealer_card"
  | "trade_point"
  | "showcase"
  | "tasks"
  | "orders"
  | "analytics"
  | "territory"
  | "sales_script"
  | "service"
  | "onboarding";

export type WikiTrainingMapReviewStatus = "needs_review" | "approved" | "archive_candidate";

export interface WikiTrainingContentMapItem {
  id: string;
  wikiTitle: string;
  wikiPageId?: number;
  section: TrainingSectionKey | "other";
  priority: WikiTrainingPriority;
  audiences: WikiTrainingAudience[];
  productScope: WikiTrainingProductScope;
  workContexts: WikiTrainingWorkContext[];
  targetProgramIds: string[];
  recommendedMaterialType: "article" | "checklist" | "script" | "course" | "regulation" | "video";
  reviewStatus: WikiTrainingMapReviewStatus;
  reason: string;
  safeSummary: string;
  migrationNotes: string[];
}

const WIKI_TRAINING_CONTENT_MAP: WikiTrainingContentMapItem[] = [
  // ——— P0 Product ———
  {
    id: "wcm-p0-mk-svod-jun2025",
    wikiTitle: "Сводная Таблица по МК от А до Я, Июнь 2025",
    section: "product",
    priority: "P0",
    audiences: ["sales_manager", "new_employee"],
    productScope: "mk",
    workContexts: ["catalog", "showcase", "trade_point"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "База консультаций по МК в салоне; без свода высокий риск ошибок в размерах и сериях.",
    safeSummary: "Свод по межкомнатным дверям: серии и логика чтения для консультанта; в публичном контуре только структура.",
    migrationNotes: ["Сверить с актуальной версией во внутренней базе после полного export."],
  },
  {
    id: "wcm-p0-vh-competitors-table",
    wikiTitle: "Сводная ТАБЛИЦА Входных Дверей с КОНКУРЕНТАМИ(выборочно Сравнительная)",
    section: "product",
    priority: "P0",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "vh",
    workContexts: ["catalog", "showcase", "sales_script"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Ключевой оптовый сценарий сравнения ВХ; нужен для единых формулировок на витрине.",
    safeSummary: "Сравнительная выборка по входным группам без раскрытия закрытых цен.",
    migrationNotes: ["Убрать чувствительные колонки при нормализации; сверка с закрытым источником."],
  },
  {
    id: "wcm-p0-vh-warehouse-table",
    wikiTitle: "Таблица входных дверей в складской программе (сводная)",
    section: "product",
    priority: "P0",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "vh",
    workContexts: ["orders", "catalog", "trade_point"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "approved",
    reason: "Связка складской программы с консультацией по ВХ.",
    safeSummary: "Сводная логика складской программы: что уточнять у снабжения.",
    migrationNotes: [],
  },
  {
    id: "wcm-p0-vh-locks",
    wikiTitle: "Замки входных дверей",
    section: "product",
    priority: "P0",
    audiences: ["sales_manager", "new_employee"],
    productScope: "vh",
    workContexts: ["catalog", "showcase", "service"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "approved",
    reason: "Частые вопросы клиента по безопасности и комплектации замков.",
    safeSummary: "Группы замков и вопросы совместимости для первой линии консультации.",
    migrationNotes: [],
  },
  {
    id: "wcm-p0-mk-presentation",
    wikiTitle: "Техника презентации межкомнатных дверей",
    section: "product",
    priority: "P0",
    audiences: ["sales_manager", "new_employee"],
    productScope: "mk",
    workContexts: ["showcase", "trade_point", "sales_script"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "course",
    reviewStatus: "approved",
    reason: "Единый сценарий визита по МК в шоуруме.",
    safeSummary: "Порядок демонстрации МК: открытие, покрытие, следующий шаг.",
    migrationNotes: [],
  },
  {
    id: "wcm-p0-acoustic-doors",
    wikiTitle: "Звукоизоляция в двери",
    section: "product",
    priority: "P0",
    audiences: ["sales_manager"],
    productScope: "all",
    workContexts: ["catalog", "showcase"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Высокая частота возражений и вопросов по акустике.",
    safeSummary: "Базовые тезисы по звукоизоляции без ссылок на закрытые лабораторные отчёты.",
    migrationNotes: ["Добавить иллюстрации после ревью юридического/технического контура."],
  },
  {
    id: "wcm-p0-pet-material",
    wikiTitle: "ПЭТ",
    section: "product",
    priority: "P0",
    audiences: ["sales_manager", "new_employee"],
    productScope: "mk",
    workContexts: ["catalog", "showcase"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "approved",
    reason: "Популярное покрытие; нужна быстрая выдача фактов на витрине.",
    safeSummary: "ПЭТ: внешний вид, уход и ограничения для витрины.",
    migrationNotes: [],
  },
  {
    id: "wcm-p0-hidden-dera-2026",
    wikiTitle: "Скрытые Двери, новинка 2026 год (DERA)",
    section: "product",
    priority: "P0",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "mk",
    workContexts: ["showcase", "catalog"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Новинка сезона; риск разрозненных формулировок без единого материала.",
    safeSummary: "Презентация скрытых дверей: отличия и монтажные акценты.",
    migrationNotes: ["Чертежи и условия поставки — только из закрытого хранилища после ревью."],
  },
  // ——— P0 Sales ———
  {
    id: "wcm-p0-anp-spin",
    wikiTitle: "АНП и СПИН",
    section: "sales",
    priority: "P0",
    audiences: ["sales_manager", "lead"],
    productScope: "all",
    workContexts: ["sales_script", "dealer_card", "analytics"],
    targetProgramIds: ["prog-sales-hits"],
    recommendedMaterialType: "script",
    reviewStatus: "approved",
    reason: "Каркас оптового диалога; снижает хаотичность первых визитов.",
    safeSummary: "Краткое описание подходов АНП и СПИН без внутренних скриптов закрытой базы.",
    migrationNotes: [],
  },
  {
    id: "wcm-p0-seven-objections",
    wikiTitle: "7 правил работы с возражениями для оптовых менеджеров",
    section: "sales",
    priority: "P0",
    audiences: ["sales_manager"],
    productScope: "all",
    workContexts: ["sales_script", "tasks"],
    targetProgramIds: ["prog-sales-hits"],
    recommendedMaterialType: "checklist",
    reviewStatus: "needs_review",
    reason: "Стандартизация реакции на возражения в опте.",
    safeSummary: "Семь правил в сжатой формулировке; кейсы расширяются после ревью.",
    migrationNotes: ["Связать с задачами из CRM после интеграции."],
  },
  {
    id: "wcm-p0-wholesale-model-compare",
    wikiTitle: "Сравнение моделей и аргументация в оптовом канале",
    section: "sales",
    priority: "P0",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "all",
    workContexts: ["sales_script", "catalog", "dealer_card"],
    targetProgramIds: ["prog-sales-hits"],
    recommendedMaterialType: "script",
    reviewStatus: "needs_review",
    reason: "Закрывает пробел между продуктовыми таблицами и разговором с дилером.",
    safeSummary: "План сравнения моделей и опорные аргументы без коммерческих условий.",
    migrationNotes: ["Нужна сверка с полным Wiki export и прайс-политикой во внутреннем контуре."],
  },
  // ——— P0 Onboarding ———
  {
    id: "wcm-p0-bitrix24-onboard",
    wikiTitle: "Битрикс24",
    section: "onboarding",
    priority: "P0",
    audiences: ["new_employee", "sales_manager"],
    productScope: "none",
    workContexts: ["onboarding", "tasks"],
    targetProgramIds: ["prog-adapt-2026"],
    recommendedMaterialType: "course",
    reviewStatus: "approved",
    reason: "Первичная цифровая среда работы нового сотрудника.",
    safeSummary: "Обзор разделов: задачи, чат, диск — без ссылок на закрытый портал.",
    migrationNotes: [],
  },
  {
    id: "wcm-p0-knowledge-standards",
    wikiTitle: "Стандарты знаний при адаптации сотрудника",
    section: "onboarding",
    priority: "P0",
    audiences: ["new_employee", "lead"],
    productScope: "none",
    workContexts: ["onboarding"],
    targetProgramIds: ["prog-adapt-2026"],
    recommendedMaterialType: "checklist",
    reviewStatus: "needs_review",
    reason: "Единая планка знаний по неделям адаптации.",
    safeSummary: "Чек-лист тем по неделям без персональных оценок.",
    migrationNotes: ["Матрицы компетенций — из закрытого HR-контура."],
  },
  {
    id: "wcm-p0-new-manager-adapt",
    wikiTitle: "Адаптация нового менеджера продаж (первые 30 дней)",
    section: "onboarding",
    priority: "P0",
    audiences: ["new_employee", "sales_manager", "lead"],
    productScope: "none",
    workContexts: ["onboarding", "dealer_card", "tasks"],
    targetProgramIds: ["prog-adapt-2026"],
    recommendedMaterialType: "course",
    reviewStatus: "needs_review",
    reason: "Снижает время выхода на автономные визиты.",
    safeSummary: "Пошаговый маршрут: продукт, CRM, визиты — только обезличенные шаблоны.",
    migrationNotes: ["Нужна сверка с полным Wiki export и внутренним планом адаптации."],
  },
  // ——— P0 Regulations ———
  {
    id: "wcm-p0-guarantee-opt",
    wikiTitle: "Гарантийные обязательства магазинов ОПТОВИК",
    section: "regulations",
    priority: "P0",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "all",
    workContexts: ["service", "dealer_card", "orders"],
    targetProgramIds: ["prog-regional-control"],
    recommendedMaterialType: "regulation",
    reviewStatus: "approved",
    reason: "Юридически значимый контур общения с партнёром.",
    safeSummary: "Структура гарантийных обязательств; полные формулировки сокращены для публичного контура.",
    migrationNotes: [],
  },
  {
    id: "wcm-p0-reclaims-pack",
    wikiTitle: "Рекламации: пакет документов и сроки",
    section: "regulations",
    priority: "P0",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "hardware",
    workContexts: ["service", "orders", "tasks"],
    targetProgramIds: ["prog-regional-control"],
    recommendedMaterialType: "checklist",
    reviewStatus: "needs_review",
    reason: "Первая линия должна одинаково озвучивать сроки и пакет документов.",
    safeSummary: "Какие документы запрашивать и какие сроки называть клиенту.",
    migrationNotes: [],
  },
  {
    id: "wcm-p0-service-catalog",
    wikiTitle: "Сервисные услуги: перечень и зоны ответственности",
    section: "regulations",
    priority: "P0",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "all",
    workContexts: ["service", "territory"],
    targetProgramIds: ["prog-regional-control"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Разграничение сервиса и продукта снижает конфликтные кейсы.",
    safeSummary: "Перечень типовых услуг и эскалаций без внутренних контактов исполнителей.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p0-purchasing-assortment",
    wikiTitle: "Закупки и актуальность ассортимента",
    section: "regulations",
    priority: "P0",
    audiences: ["regional_manager", "lead"],
    productScope: "all",
    workContexts: ["orders", "catalog", "territory"],
    targetProgramIds: ["prog-regional-control"],
    recommendedMaterialType: "regulation",
    reviewStatus: "needs_review",
    reason: "Региональному контуру нужна единая логика обновления полки.",
    safeSummary: "Критерии актуальности ассортимента и коммуникации с закупками — обезличенно.",
    migrationNotes: ["Связка с внутренними регламентами закупок после ревью."],
  },
  // ——— P1 Product depth ———
  {
    id: "wcm-p1-lacquer-finishes",
    wikiTitle: "Лак",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager"],
    productScope: "mk",
    workContexts: ["catalog", "showcase"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Углубление по покрытиям после базовых МК-материалов.",
    safeSummary: "Нормализованная аннотация по лаковым системам для витрины.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p1-engineered-timber",
    wikiTitle: "Инженерный брус",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager"],
    productScope: "mk",
    workContexts: ["catalog", "showcase"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Специализированные вопросы по конструкции полотна.",
    safeSummary: "Краткое описание свойств и ограничений для консультанта.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p1-mezzo-porte",
    wikiTitle: "Mezzo Porte",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "mk",
    workContexts: ["catalog", "showcase"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Брендовая линейка требует отдельного каркаса аргументации.",
    safeSummary: "Позиционирование линейки без коммерческих обязательств.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p1-fine-floor",
    wikiTitle: "Fine Floor",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager"],
    productScope: "mk",
    workContexts: ["catalog", "showcase"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Согласованные ответы по сопутствующей линейке.",
    safeSummary: "Краткая аннотация для связки с межкомнатными решениями.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p1-galvanized-metal",
    wikiTitle: "Оцинкованный металл",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager"],
    productScope: "vh",
    workContexts: ["catalog", "showcase"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Технические вопросы по входным конструкциям.",
    safeSummary: "Базовые свойства и зоны применения — без заводских чертежей.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p1-birch-plywood",
    wikiTitle: "Березовая фанера",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager"],
    productScope: "mk",
    workContexts: ["catalog"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Материаловедческое углубление для сложных консультаций.",
    safeSummary: "Краткие тезисы по фанере в составе изделий.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p1-deart-line",
    wikiTitle: "DeArt",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "mk",
    workContexts: ["showcase", "catalog"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Отдельная линейка в коммуникации с дизайн-сегментом.",
    safeSummary: "Позиционирование и отличия — нейтральная выжимка.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p1-thermo-condensate",
    wikiTitle: "Конденсат на термодверях",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "vh",
    workContexts: ["service", "showcase"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Частые постгарантийные вопросы; нужен единый безопасный ответ.",
    safeSummary: "Объяснение явления и шаги эскалации без внутренних актов.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p2-milliana",
    wikiTitle: "Мильяна",
    section: "product",
    priority: "P2",
    audiences: ["sales_manager"],
    productScope: "mk",
    workContexts: ["catalog"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Узкая тема; приоритет после ядра МК.",
    safeSummary: "Краткая справка по линейке для базы знаний.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  {
    id: "wcm-p2-paradise",
    wikiTitle: "Paradise",
    section: "product",
    priority: "P2",
    audiences: ["sales_manager"],
    productScope: "mk",
    workContexts: ["catalog"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "article",
    reviewStatus: "needs_review",
    reason: "Вторичный приоритет относительно сводных таблиц.",
    safeSummary: "Краткая справка по линейке.",
    migrationNotes: ["Нужна сверка с полным Wiki export."],
  },
  // ——— P2 / other programs & gaps ———
  {
    id: "wcm-p2-lead-forecast-review",
    wikiTitle: "Руководитель: обзор прогноза и контрольные вопросы по территории",
    section: "development",
    priority: "P2",
    audiences: ["lead"],
    productScope: "none",
    workContexts: ["territory", "analytics"],
    targetProgramIds: [],
    recommendedMaterialType: "checklist",
    reviewStatus: "needs_review",
    reason: "Для руководителя мало готовых связок Wiki → учебные модули.",
    safeSummary: "Чек-лист вопросов к менеджеру без финансовых деталей.",
    migrationNotes: ["Завести программу «Развитие / контроль» и перенести после export."],
  },
  {
    id: "wcm-p1-regional-showcase-audit",
    wikiTitle: "Региональный контроль витрин: чек-лист аудита",
    section: "regulations",
    priority: "P1",
    audiences: ["regional_manager"],
    productScope: "all",
    workContexts: ["showcase", "territory", "trade_point"],
    targetProgramIds: ["prog-regional-control"],
    recommendedMaterialType: "checklist",
    reviewStatus: "needs_review",
    reason: "Связка территории и витрины сейчас слабо покрыта в обучении.",
    safeSummary: "Полевой чек-лист без фото и персональных данных точек.",
    migrationNotes: ["Нужна отдельная программа по витринам или расширение prog-regional-control после ревью."],
  },
  {
    id: "wcm-p1-hardware-program-gap",
    wikiTitle: "Фурнитура: единая программа обучения (сборка из Wiki)",
    section: "product",
    priority: "P1",
    audiences: ["sales_manager", "regional_manager"],
    productScope: "hardware",
    workContexts: ["catalog", "showcase", "tasks"],
    targetProgramIds: ["prog-product-lines"],
    recommendedMaterialType: "course",
    reviewStatus: "needs_review",
    reason: "Нет отдельной программы только по фурнитуре — материалы разрознены.",
    safeSummary: "План объединения статей по фурнитуре в один трек.",
    migrationNotes: ["Нужна отдельная программа по фурнитуре; сверка с каталогом SKU."],
  },
  {
    id: "wcm-p2-sku-wiki-binding",
    wikiTitle: "Связка Wiki ↔ конкретные SKU каталога (матрица покрытия)",
    section: "other",
    priority: "P2",
    audiences: ["lead", "regional_manager"],
    productScope: "all",
    workContexts: ["catalog"],
    targetProgramIds: ["prog-product-lines", "prog-regional-control"],
    recommendedMaterialType: "checklist",
    reviewStatus: "needs_review",
    reason: "Без матрицы покрытия сложно приоритизировать импорт.",
    safeSummary: "Инвентаризация: какие SKU уже имеют статью в закрытой базе — только структура, без списков цен.",
    migrationNotes: ["Нужна связка Wiki ↔ SKU после полного export и ревью."],
  },
];

export function getWikiTrainingContentMap(): WikiTrainingContentMapItem[] {
  return WIKI_TRAINING_CONTENT_MAP;
}

export type WikiTrainingContentMapSummary = {
  total: number;
  byPriority: Record<WikiTrainingPriority, number>;
  byAudience: Record<WikiTrainingAudience, number>;
  bySection: Record<string, number>;
  byProductScope: Record<WikiTrainingProductScope, number>;
  needsReview: number;
  catalogLinked: number;
};

export function getWikiTrainingContentMapSummary(): WikiTrainingContentMapSummary {
  const map = WIKI_TRAINING_CONTENT_MAP;
  const byPriority: Record<WikiTrainingPriority, number> = { P0: 0, P1: 0, P2: 0 };
  const byAudience: Record<WikiTrainingAudience, number> = {
    sales_manager: 0,
    regional_manager: 0,
    lead: 0,
    new_employee: 0,
  };
  const bySection: Record<string, number> = {};
  const byProductScope: Record<WikiTrainingProductScope, number> = {
    mk: 0,
    vh: 0,
    hardware: 0,
    all: 0,
    none: 0,
  };
  let needsReview = 0;
  let catalogLinked = 0;

  for (const item of map) {
    byPriority[item.priority] += 1;
    if (item.reviewStatus === "needs_review") needsReview += 1;
    if (item.productScope !== "none") catalogLinked += 1;
    for (const a of item.audiences) {
      byAudience[a] += 1;
    }
    bySection[item.section] = (bySection[item.section] ?? 0) + 1;
    byProductScope[item.productScope] += 1;
  }

  return {
    total: map.length,
    byPriority,
    byAudience,
    bySection,
    byProductScope,
    needsReview,
    catalogLinked,
  };
}

export function getWikiTrainingContentByPriority(priority: WikiTrainingPriority): WikiTrainingContentMapItem[] {
  return WIKI_TRAINING_CONTENT_MAP.filter((i) => i.priority === priority);
}

export function getWikiTrainingContentByAudience(audience: WikiTrainingAudience): WikiTrainingContentMapItem[] {
  return WIKI_TRAINING_CONTENT_MAP.filter((i) => i.audiences.includes(audience));
}

export function getWikiTrainingContentByProgram(programId: string): WikiTrainingContentMapItem[] {
  return WIKI_TRAINING_CONTENT_MAP.filter((i) => i.targetProgramIds.includes(programId));
}

export function getWikiTrainingContentByProductScope(scope: WikiTrainingProductScope): WikiTrainingContentMapItem[] {
  return WIKI_TRAINING_CONTENT_MAP.filter((i) => i.productScope === scope);
}

export function getWikiTrainingContentByWorkContext(context: WikiTrainingWorkContext): WikiTrainingContentMapItem[] {
  return WIKI_TRAINING_CONTENT_MAP.filter((i) => i.workContexts.includes(context));
}

export function getWikiTrainingContentGaps(): string[] {
  const map = WIKI_TRAINING_CONTENT_MAP;
  const gaps: string[] = [];
  const leadN = map.filter((i) => i.audiences.includes("lead")).length;
  const devN = map.filter((i) => i.section === "development").length;

  if (leadN < 5) {
    gaps.push("Мало материалов по руководителю (lead) в карте — расширить после полного Wiki export.");
  }
  if (devN < 3) {
    gaps.push("Мало материалов по развитию (development) — нужна программа и статьи из Wiki.");
  }
  gaps.push("Нужна отдельная программа по фурнитуре с устойчивым набором P0-материалов.");
  gaps.push("Нужен отдельный трек по региональному контролю витрин или расширение prog-regional-control.");
  gaps.push("Нужна связка Wiki ↔ конкретные SKU каталога (матрица покрытия) после выгрузки и ревью.");
  gaps.push("Мало видео-сценариев в карте (тип video) — пополнить при появлении безопасных роликов.");
  gaps.push("Нет программы «Развитие» в каталоге учебных программ — завести после согласования с L&D.");
  return gaps;
}
