/**
 * Первая волна переноса: позиция карты Wiki → опубликованный материал в разделе «Обучение».
 * Без URL закрытой Wiki и без служебных ссылок.
 */
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

/** Исходные заголовки Wiki и метаданные импорта для бейджа «Wiki» в карточке материала. */
export const WAVE1_TRAINING_WIKI_ANNOTATIONS: Record<
  string,
  {
    wikiTitle: string;
    wikiImportedAt: string;
    wikiCharCount: number;
    wikiSectionGuess: "product" | "sales" | "onboarding" | "regulations" | "development" | "other";
    wikiCatalogLine?: "mk" | "vh" | "hardware" | "all";
  }
> = {
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
