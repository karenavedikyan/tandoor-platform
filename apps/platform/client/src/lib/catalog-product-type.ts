/** Общая модель позиции каталога платформы (публичный импорт + демо-мок). */
export type CatalogProduct = {
  id: string;
  name: string;
  article: string;
  category: string;
  series: string;
  type: string;
  doorKind: string;
  status: string;
  image: string | null;
  shortDescription: string;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  equipment: string[];
  variants: { label: string; value: string }[];
  colors: string[];
  sizes: string[];
  manufacturer: string;
  warranty: string;
  coating: string;
  openType: string;
  isTop: boolean;
  isNew: boolean;
  isExclusive: boolean;
  isAction: boolean;
  inStock: boolean;
  showcasePriority: number;
  salesPriority: number;
  recommendedForShowcase: boolean;
  relatedDealerIds: string[];
  relatedTradePointIds: string[];
  relatedTaskCount: number;
  history: { date: string; event: string }[];
  /** Ссылка на публичную карточку на сайте Tandoor (для справки менеджера). */
  sourcePublicUrl?: string;
  /** Розничная цена с публичной витрины, если передана в seed. */
  priceRetailRub?: number;
  /** Дополнительные токены для поиска в каталоге платформы. */
  catalogTags?: string[];
  /** Нормализованная строка поиска (категория, теги, коллекция). */
  catalogSearchText?: string;
  /** Если false — позиция не попадает в мок матрицы витрин ТТ (по умолчанию true). */
  includeInTradePointMatrix?: boolean;
  /** Галерея с публичного импорта (главное фото дублируется в `image`). */
  catalogImages?: { src: string; alt: string }[];
};
