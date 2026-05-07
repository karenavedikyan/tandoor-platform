/**
 * Соответствие позиций карты Wiki → материалы в разделе «Обучение» (продуктовый контур).
 * Без URL закрытой Wiki и без служебных ссылок.
 */

/** Первая волна (ранее выгруженные P0). */
export const WAVE1_PUBLISHED_TRAINING_BY_WIKI_MAP_ID: Record<string, string> = {
  "wcm-p0-mk-svod-jun2025": "tr-prod-mk-assortment",
  "wcm-p0-vh-competitors-table": "tr-prod-vh-sales-pack",
  "wcm-p0-vh-warehouse-table": "tr-prod-ent-card",
  "wcm-p0-vh-locks": "tr-prod-vh-locks-guide",
  "wcm-p0-mk-presentation": "tr-sales-consult-prep",
  "wcm-p0-acoustic-doors": "tr-prod-int-coatings",
  "wcm-p0-pet-material": "tr-prod-materials-mdf",
  "wcm-p0-hidden-dera-2026": "tr-prod-mk-lines-diff",
};

/** Дополнительные продуктовые позиции карты Wiki (P1/P2, программа фурнитуры). */
export const EXTENDED_PRODUCT_WIKI_PUBLISHED_TRAINING_BY_WIKI_MAP_ID: Record<string, string> = {
  "wcm-p1-lacquer-finishes": "tr-prod-mk-lacquer-finishes",
  "wcm-p1-engineered-timber": "tr-prod-mk-engineered-wood-core",
  "wcm-p1-mezzo-porte": "tr-prod-mk-line-mezzo-porte",
  "wcm-p1-fine-floor": "tr-prod-mk-fine-floor-companion",
  "wcm-p1-galvanized-metal": "tr-prod-vh-galvanized-skin",
  "wcm-p1-birch-plywood": "tr-prod-mk-birch-plywood-core",
  "wcm-p1-deart-line": "tr-prod-mk-line-deart",
  "wcm-p1-thermo-condensate": "tr-prod-vh-thermo-condensate-care",
  "wcm-p2-milliana": "tr-prod-mk-line-milliana",
  "wcm-p2-paradise": "tr-prod-mk-line-paradise",
  "wcm-p1-hardware-program-gap": "tr-prod-hw-sales-track-overview",
};

/** Полное соответствие для очереди публикации и ревью карты. */
export const PRODUCT_WIKI_PUBLISHED_TRAINING_BY_WIKI_MAP_ID: Record<string, string> = {
  ...WAVE1_PUBLISHED_TRAINING_BY_WIKI_MAP_ID,
  ...EXTENDED_PRODUCT_WIKI_PUBLISHED_TRAINING_BY_WIKI_MAP_ID,
};

export type WikiTrainingMaterialAnnotation = {
  wikiTitle: string;
  wikiImportedAt: string;
  wikiCharCount: number;
  wikiSectionGuess: "product" | "sales" | "onboarding" | "regulations" | "development" | "other";
  wikiCatalogLine?: "mk" | "vh" | "hardware" | "all";
};

/** Исходные заголовки Wiki и метаданные импорта для бейджа «Wiki». */
export const WAVE1_TRAINING_WIKI_ANNOTATIONS: Record<string, WikiTrainingMaterialAnnotation> = {
  "tr-prod-mk-assortment": {
    wikiTitle: "Сводная Таблица по МК от А до Я, Июнь 2025",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 9200,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-vh-sales-pack": {
    wikiTitle: "Сводная ТАБЛИЦА Входных Дверей с КОНКУРЕНТАМИ(выборочно Сравнительная)",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 8800,
    wikiSectionGuess: "product",
    wikiCatalogLine: "vh",
  },
  "tr-prod-ent-card": {
    wikiTitle: "Таблица входных дверей в складской программе (сводная)",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 7600,
    wikiSectionGuess: "product",
    wikiCatalogLine: "vh",
  },
  "tr-prod-vh-locks-guide": {
    wikiTitle: "Замки входных дверей",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 5400,
    wikiSectionGuess: "product",
    wikiCatalogLine: "vh",
  },
  "tr-sales-consult-prep": {
    wikiTitle: "Техника презентации межкомнатных дверей",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 6200,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-int-coatings": {
    wikiTitle: "Звукоизоляция в двери",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 4800,
    wikiSectionGuess: "product",
    wikiCatalogLine: "all",
  },
  "tr-prod-materials-mdf": {
    wikiTitle: "ПЭТ",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 4100,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-mk-lines-diff": {
    wikiTitle: "Скрытые Двери, новинка 2026 год (DERA)",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 5000,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
};

const EXTENDED_PRODUCT_WIKI_ANNOTATIONS: Record<string, WikiTrainingMaterialAnnotation> = {
  "tr-prod-mk-lacquer-finishes": {
    wikiTitle: "Лак",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 4200,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-mk-engineered-wood-core": {
    wikiTitle: "Инженерный брус",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 3800,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-mk-line-mezzo-porte": {
    wikiTitle: "Mezzo Porte",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 3600,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-mk-fine-floor-companion": {
    wikiTitle: "Fine Floor",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 3400,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-vh-galvanized-skin": {
    wikiTitle: "Оцинкованный металл",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 3900,
    wikiSectionGuess: "product",
    wikiCatalogLine: "vh",
  },
  "tr-prod-mk-birch-plywood-core": {
    wikiTitle: "Березовая фанера",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 3500,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-mk-line-deart": {
    wikiTitle: "DeArt",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 3700,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-vh-thermo-condensate-care": {
    wikiTitle: "Конденсат на термодверях",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 4000,
    wikiSectionGuess: "product",
    wikiCatalogLine: "vh",
  },
  "tr-prod-mk-line-milliana": {
    wikiTitle: "Мильяна",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 2800,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-mk-line-paradise": {
    wikiTitle: "Paradise",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 2800,
    wikiSectionGuess: "product",
    wikiCatalogLine: "mk",
  },
  "tr-prod-hw-sales-track-overview": {
    wikiTitle: "Фурнитура: единая программа обучения (сборка из Wiki)",
    wikiImportedAt: "06.05.2026",
    wikiCharCount: 4500,
    wikiSectionGuess: "product",
    wikiCatalogLine: "hardware",
  },
};

/** Все аннотации Wiki для материалов, перенесённых из карты. */
export const ALL_PRODUCT_WIKI_ANNOTATIONS: Record<string, WikiTrainingMaterialAnnotation> = {
  ...WAVE1_TRAINING_WIKI_ANNOTATIONS,
  ...EXTENDED_PRODUCT_WIKI_ANNOTATIONS,
};
