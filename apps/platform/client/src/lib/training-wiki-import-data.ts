/**
 * Первая волна импорта из корпоративной Wiki (MediaWiki): только нормализованные
 * безопасные фрагменты для публичного репозитория. Полные тексты, закрытые URL,
 * учётные данные и дампы не включаются.
 *
 * Идентификаторы страниц MediaWiki: если в выгрузке не зафиксированы, поле pageId
 * опускается — в UI используется стабильный внутренний id материала `wiki-*`.
 */

export type WikiTrainingSectionKey = "product" | "sales" | "onboarding" | "regulations" | "development" | "other";

export type WikiTrainingReviewStatus = "needs_review" | "approved" | "archived";

export type WikiTrainingImportSeedItem = {
  /** Номер страницы в MediaWiki, если известен из закрытой выгрузки. */
  pageId?: number;
  title: string;
  section: WikiTrainingSectionKey;
  charCount: number;
  categories: string[];
  importedAt: string;
  reviewStatus: WikiTrainingReviewStatus;
  summary: string;
  contentBlocks: Array<{ heading: string; body: string }>;
  knowledgeTags: string[];
  relatedProductCategory: "mk" | "vh" | "hardware" | "all" | null;
  /** Привязка к товарам каталога для карточки товара. */
  linkedProductIds?: string[];
};

/**
 * Стабильный внутренний id для hash-маршрута: `wiki-` + короткий хэш заголовка.
 * Не является публичным URL Wiki.
 */
export function wikiSeedMaterialId(title: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < title.length; i += 1) {
    h ^= title.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `wiki-${(h >>> 0).toString(36)}`;
}

export const WIKI_TRAINING_IMPORT_SEED: WikiTrainingImportSeedItem[] = [
  {
    title: "Сводная Таблица по МК от А до Я, Июнь 2025",
    section: "product",
    charCount: 12400,
    categories: ["МК", "Сводные таблицы"],
    importedAt: "04.05.2026",
    reviewStatus: "needs_review",
    summary:
      "Свод по межкомнатным дверям: серии, типовые размеры и логика чтения таблицы для консультации в салоне. Расширенные колонки уточняйте у руководителя или в службе поддержки бренда.",
    contentBlocks: [
      {
        heading: "Как пользоваться сводом",
        body: "Определите серию и исполнение, затем сверьте доступность с региональным планом. В публичном контуре показана только структура без коммерческих колонок.",
      },
    ],
    knowledgeTags: ["МК", "сводная таблица", "июнь 2025"],
    relatedProductCategory: "mk",
    linkedProductIds: ["mk-grand-3-mk", "mk-kapelli"],
  },
  {
    title: "Сводная ТАБЛИЦА Входных Дверей с КОНКУРЕНТАМИ(выборочно Сравнительная)",
    section: "product",
    charCount: 18200,
    categories: ["ВХ", "Конкуренты"],
    importedAt: "04.05.2026",
    reviewStatus: "needs_review",
    summary:
      "Сравнительная выборка по входным группам: позиционирование без раскрытия коммерчески чувствительных цен и поставщиков.",
    contentBlocks: [
      {
        heading: "Сценарий сравнения",
        body: "Используйте блоки «конструкция», «фурнитура», «срок» как опорные точки разговора. Детальные строки таблицы уточняйте у руководителя или в актуальной версии прайс-листа.",
      },
    ],
    knowledgeTags: ["ВХ", "конкуренты", "сравнение"],
    relatedProductCategory: "vh",
    linkedProductIds: ["vh-grand-3", "vh-grand-4"],
  },
  {
    title: "Таблица входных дверей в складской программе (сводная)",
    section: "product",
    charCount: 9600,
    categories: ["ВХ", "Склад"],
    importedAt: "03.05.2026",
    reviewStatus: "approved",
    summary: "Сводная логика складской программы по входным моделям: что показывать клиенту и что уточнять у снабжения.",
    contentBlocks: [
      {
        heading: "Складской контекст",
        body: "Кратко зафиксированы типовые статусы и переходы к заказу без артикулов складской учётной системы в тексте.",
      },
    ],
    knowledgeTags: ["ВХ", "склад"],
    relatedProductCategory: "vh",
    linkedProductIds: ["vh-grand-4"],
  },
  {
    title: "Замки входных дверей",
    section: "product",
    charCount: 4200,
    categories: ["ВХ", "Фурнитура"],
    importedAt: "02.05.2026",
    reviewStatus: "approved",
    summary: "Обзор групп замков для входных дверей: совместимость и вопросы безопасности для консультации.",
    contentBlocks: [
      {
        heading: "Ключевые вопросы",
        body: "Согласование класса замка с полотном и требованиями объекта. Расширенные спецификации запрашивайте у поставщика или в актуальном техническом бюллетене.",
      },
    ],
    knowledgeTags: ["замки", "ВХ"],
    relatedProductCategory: "vh",
    linkedProductIds: ["vh-grand-3"],
  },
  {
    title: "Техника презентации межкомнатных дверей",
    section: "product",
    charCount: 5100,
    categories: ["МК", "Презентация"],
    importedAt: "01.05.2026",
    reviewStatus: "approved",
    summary: "Порядок демонстрации МК в шоуруме: открытие, фокус на покрытии, завершение визита переходом к следующему шагу.",
    contentBlocks: [
      {
        heading: "Структура визита",
        body: "Нейтральный сценарий для витрины: без персональных данных клиента и без обещаний, которые требуют согласования с руководителем.",
      },
    ],
    knowledgeTags: ["МК", "презентация"],
    relatedProductCategory: "mk",
    linkedProductIds: ["mk-grand-5"],
  },
  {
    title: "Звукоизоляция в двери",
    section: "product",
    charCount: 3800,
    categories: ["МК", "ВХ", "Акустика"],
    importedAt: "30.04.2026",
    reviewStatus: "needs_review",
    summary: "Базовые тезисы по звукоизоляции полотен и комплектации для ответов клиенту.",
    contentBlocks: [
      {
        heading: "Объяснение клиенту",
        body: "Коротко о слоях и сертификации; полные протоколы испытаний запрашивайте у бренда при необходимости.",
      },
    ],
    knowledgeTags: ["звукоизоляция"],
    relatedProductCategory: "all",
  },
  {
    title: "ПЭТ",
    section: "product",
    charCount: 2900,
    categories: ["МК", "Материалы"],
    importedAt: "29.04.2026",
    reviewStatus: "approved",
    summary: "Материал ПЭТ: внешний вид, уход и типовые ограничения для витрины.",
    contentBlocks: [
      {
        heading: "Сводка",
        body: "Сжатое описание для консультанта; полные техлисты запрашивайте у поставщика при необходимости.",
      },
    ],
    knowledgeTags: ["ПЭТ", "покрытие"],
    relatedProductCategory: "mk",
    linkedProductIds: ["mk-grand-5"],
  },
  {
    title: "Скрытые Двери, новинка 2026 год (DERA)",
    section: "product",
    charCount: 6100,
    categories: ["Скрытые двери", "Новинки"],
    importedAt: "28.04.2026",
    reviewStatus: "needs_review",
    summary: "Презентация линейки скрытых дверей: отличия, монтажные акценты, без коммерческих условий.",
    contentBlocks: [
      {
        heading: "Новинка 2026",
        body: "Акцент на назначении и сочетаемости с интерьером; подробные чертежи запрашивайте у технической поддержки бренда.",
      },
    ],
    knowledgeTags: ["скрытые двери", "DERA"],
    relatedProductCategory: "mk",
  },
  {
    title: "АНП и СПИН",
    section: "sales",
    charCount: 2200,
    categories: ["Продажи", "Опт"],
    importedAt: "27.04.2026",
    reviewStatus: "approved",
    summary:
      "Краткое описание подходов АНП и СПИН для оптового диалога: как задавать вопросы, выявлять потребность и переходить к подбору решения.",
    contentBlocks: [
      {
        heading: "Применение",
        body: "Используйте как каркас вопросов; расширенные методички и примеры диалогов согласуйте с наставником.",
      },
    ],
    knowledgeTags: ["АНП", "СПИН", "опт"],
    relatedProductCategory: "all",
  },
  {
    title: "7 правил работы с возражениями для оптовых менеджеров",
    section: "sales",
    charCount: 4500,
    categories: ["Продажи", "Возражения"],
    importedAt: "26.04.2026",
    reviewStatus: "needs_review",
    summary:
      "Семь правил работы с возражениями: как сохранить диалог, уточнить причину сомнения и предложить следующий шаг.",
    contentBlocks: [
      {
        heading: "Правила",
        body: "Нумерованный список с пояснением одной строки на правило. Не заменяет живой тренинг.",
      },
    ],
    knowledgeTags: ["возражения", "опт"],
    relatedProductCategory: "all",
  },
  {
    title: "Битрикс24",
    section: "onboarding",
    charCount: 8800,
    categories: ["Онбординг", "Инструменты"],
    importedAt: "25.04.2026",
    reviewStatus: "approved",
    summary: "Обзор разделов Битрикс24, используемых отделом: задачи, чат, диск — без прямых ссылок на корпоративный портал в этом материале.",
    contentBlocks: [
      {
        heading: "Для нового сотрудника",
        body: "Что открыть в первую неделю и как фиксировать активность. Учётные записи выдаются отделом кадров.",
      },
    ],
    knowledgeTags: ["Битрикс24", "онбординг"],
    relatedProductCategory: null,
  },
  {
    title: "Стандарты знаний при адаптации сотрудника",
    section: "onboarding",
    charCount: 3600,
    categories: ["Онбординг", "Стандарты"],
    importedAt: "24.04.2026",
    reviewStatus: "needs_review",
    summary: "Чек-лист знаний по неделям адаптации; развёрнутые матрицы компетенций выдаёт наставник или HR.",
    contentBlocks: [
      {
        heading: "Недели 1–4",
        body: "Ключевые темы и контрольные вопросы наставнику без персональных оценок.",
      },
    ],
    knowledgeTags: ["адаптация", "стандарты"],
    relatedProductCategory: null,
  },
  {
    title: "Гарантийные обязательства магазинов ОПТОВИК",
    section: "regulations",
    charCount: 7200,
    categories: ["Регламенты", "Гарантия"],
    importedAt: "23.04.2026",
    reviewStatus: "approved",
    summary: "Структура гарантийных обязательств для магазинов оптового канала; юридические формулировки сокращены.",
    contentBlocks: [
      {
        heading: "Обязательства",
        body: "Перечень блоков для ознакомления менеджера; полный регламент согласуется с юридической службой.",
      },
    ],
    knowledgeTags: ["гарантия", "опт"],
    relatedProductCategory: "all",
  },
  {
    title: "Рекламации: пакет документов и сроки",
    section: "regulations",
    charCount: 5400,
    categories: ["Рекламации", "Документы"],
    importedAt: "22.04.2026",
    reviewStatus: "needs_review",
    summary: "Какие документы запрашивать и какие сроки озвучивать клиенту на первой линии.",
    contentBlocks: [
      {
        heading: "Первичная линия",
        body: "Список полей и действий без номеров заявок и сканов из вашей учётной системы в этом тексте.",
      },
    ],
    knowledgeTags: ["рекламации", "документы"],
    relatedProductCategory: "hardware",
  },
];
