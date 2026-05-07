/**
 * Локальные обезличенные материалы раздела «Обучение / База знаний».
 * Структура отражает потоки корпоративной Wiki; импорт и URL закрытой Wiki не используются.
 */

import { getAllMatrixTasks } from "./trade-point-task-data";

export type TrainingSection =
  | "product"
  | "sales"
  | "onboarding"
  | "regulations"
  | "development";

export type TrainingAudience =
  | "employees"
  | "dealers"
  | "managers"
  | "regional_managers"
  | "purchasing"
  | "all";

export type TrainingMaterialType =
  | "article"
  | "course"
  | "script"
  | "comparison"
  | "regulation"
  | "faq"
  | "video";

export type TrainingMaterialStatus = "required" | "recommended" | "new" | "updated";

export type TrainingMaterial = {
  id: string;
  title: string;
  section: TrainingSection;
  type: TrainingMaterialType;
  audience: TrainingAudience[];
  status: TrainingMaterialStatus;
  description: string;
  readTimeMinutes: number;
  progressPercent: number;
  relatedProductIds: string[];
  relatedTaskIds: string[];
  tags: string[];
  updatedAt: string;
  contentBlocks: Array<{
    heading: string;
    body: string;
  }>;
};

const block = (heading: string, body: string) => ({ heading, body });

export const TRAINING_SECTION_LABEL: Record<TrainingSection, string> = {
  product: "Продукт",
  sales: "Техника продаж",
  onboarding: "Онбординг",
  regulations: "Регламенты",
  development: "Развитие",
};

export const TRAINING_TYPE_LABEL: Record<TrainingMaterialType, string> = {
  article: "Статья",
  course: "Курс",
  script: "Скрипт",
  comparison: "Сравнение",
  regulation: "Регламент",
  faq: "FAQ",
  video: "Видео",
};

export const TRAINING_STATUS_LABEL: Record<TrainingMaterialStatus, string> = {
  required: "Обязательно",
  recommended: "Рекомендовано",
  new: "Новое",
  updated: "Обновлено",
};

export const TRAINING_AUDIENCE_LABEL: Record<TrainingAudience, string> = {
  employees: "Сотрудники",
  dealers: "Дилеры",
  managers: "Менеджеры",
  regional_managers: "Региональные менеджеры",
  purchasing: "Закупки",
  all: "Все роли",
};

const MATERIALS: TrainingMaterial[] = [
  {
    id: "tr-prod-ent-card",
    title: "Входные двери: как читать карточку модели",
    section: "product",
    type: "article",
    audience: ["managers", "dealers", "employees"],
    status: "required",
    description: "Разбор полей карточки входной группы и типовых вопросов клиента.",
    readTimeMinutes: 12,
    progressPercent: 0,
    relatedProductIds: ["vh-grand-3", "vh-grand-4"],
    relatedTaskIds: [],
    tags: ["ВХ", "карточка"],
    updatedAt: "28.04.2026",
    contentBlocks: [
      block("Назначение", "Материал помогает быстро ориентироваться в обозначениях серии, полотна и комплектации без обращения к внутренним системам."),
      block("Структура", "Рассматриваются блоки «серия», «размеры», «покрытие» и «сроки»; приводятся нейтральные примеры формулировок для клиента."),
    ],
  },
  {
    id: "tr-prod-int-coatings",
    title: "Межкомнатные двери: покрытия и отличия",
    section: "product",
    type: "article",
    audience: ["managers", "dealers"],
    status: "recommended",
    description: "Сравнение покрытий и аргументы для консультации в шоуруме.",
    readTimeMinutes: 15,
    progressPercent: 40,
    relatedProductIds: ["mk-grand-3-mk", "mk-kapelli"],
    relatedTaskIds: [],
    tags: ["МК", "покрытие"],
    updatedAt: "02.05.2026",
    contentBlocks: [
      block("Обзор", "Кратко описаны визуальные и эксплуатационные отличия без ссылок на закрытые каталоги."),
      block("Практика", "Таблица нейтральных формулировок для сравнения двух вариантов у клиента."),
    ],
  },
  {
    id: "tr-prod-hw-groups",
    title: "Фурнитура: базовые группы и аргументы",
    section: "product",
    type: "course",
    audience: ["managers", "purchasing"],
    status: "new",
    description: "Группы фурнитуры и логика допродажи в заказе.",
    readTimeMinutes: 20,
    progressPercent: 0,
    relatedProductIds: ["sk-line"],
    relatedTaskIds: [],
    tags: ["Фурнитура", "допродажа"],
    updatedAt: "05.05.2026",
    contentBlocks: [block("Группы", "Классификация по назначению и совместимости с типовыми полотнами."), block("Аргументация", "Нейтральные тезисы без цен и персональных данных.")],
  },
  {
    id: "tr-prod-materials-mdf",
    title: "Материалы: MDF, HDF, SPC, ПЭТ",
    section: "product",
    type: "comparison",
    audience: ["dealers", "managers"],
    status: "updated",
    description: "Сравнение материалов полотна для ответов клиенту.",
    readTimeMinutes: 10,
    progressPercent: 75,
    relatedProductIds: ["mk-grand-5", "vh-neapol"],
    relatedTaskIds: [],
    tags: ["материалы"],
    updatedAt: "30.04.2026",
    contentBlocks: [block("Сводка", "Краткие характеристики каждого материала и зоны применения.")],
  },
  {
    id: "tr-prod-metal-qr",
    title: "Металлоконструкции: работа с QR-карточками",
    section: "product",
    type: "faq",
    audience: ["managers", "regional_managers"],
    status: "recommended",
    description: "Как объяснять клиенту назначение QR на изделии.",
    readTimeMinutes: 8,
    progressPercent: 20,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["МК", "QR"],
    updatedAt: "22.04.2026",
    contentBlocks: [block("Сценарий", "Пошаговый разговор без технических идентификаторов из внутренних систем.")],
  },
  {
    id: "tr-sales-expensive",
    title: "Работа с возражением «дорого»",
    section: "sales",
    type: "script",
    audience: ["managers", "dealers"],
    status: "required",
    description: "Скрипт отработки ценового возражения.",
    readTimeMinutes: 7,
    progressPercent: 55,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["возражения"],
    updatedAt: "01.05.2026",
    contentBlocks: [block("Вступление", "Нейтральный тон и фокус на ценности, без обещаний скидок."), block("Закрытие", "Переход к следующему шагу воронки.")],
  },
  {
    id: "tr-sales-call",
    title: "Телефонный звонок клиенту",
    section: "sales",
    type: "script",
    audience: ["managers"],
    status: "recommended",
    description: "Структура звонка и контрольные вопросы.",
    readTimeMinutes: 9,
    progressPercent: 0,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["звонок"],
    updatedAt: "27.04.2026",
    contentBlocks: [block("План", "Открытие, цель звонка, фиксация договорённостей.")],
  },
  {
    id: "tr-sales-wholesale",
    title: "Аргументы для оптового клиента",
    section: "sales",
    type: "article",
    audience: ["managers", "regional_managers"],
    status: "recommended",
    description: "Тезисы для B2B-диалога.",
    readTimeMinutes: 11,
    progressPercent: 30,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["опт"],
    updatedAt: "26.04.2026",
    contentBlocks: [block("Контекст", "Общие выгоды сотрудничества без коммерческих условий.")],
  },
  {
    id: "tr-sales-compare-models",
    title: "Сравнение моделей в разговоре с клиентом",
    section: "sales",
    type: "video",
    audience: ["dealers", "managers"],
    status: "new",
    description: "Короткий разбор подачи двух моделей в одной встрече.",
    readTimeMinutes: 14,
    progressPercent: 0,
    relatedProductIds: ["vh-kvarc", "vh-siriys"],
    relatedTaskIds: [],
    tags: ["сравнение"],
    updatedAt: "04.05.2026",
    contentBlocks: [block("Сюжет", "Последовательность вопросов и демонстрации без записи экрана внутренних систем.")],
  },
  {
    id: "tr-onboard-manager",
    title: "Адаптация нового менеджера",
    section: "onboarding",
    type: "course",
    audience: ["employees", "managers"],
    status: "required",
    description: "Первые две недели в роли: чек-листы и встречи.",
    readTimeMinutes: 25,
    progressPercent: 10,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["адаптация"],
    updatedAt: "20.04.2026",
    contentBlocks: [block("Неделя 1", "Основные разделы платформы и правила коммуникации."), block("Неделя 2", "Работа с клиентской базой и задачами в учебном режиме.")],
  },
  {
    id: "tr-onboard-wholesale-staff",
    title: "Базовый курс сотрудника опта",
    section: "onboarding",
    type: "course",
    audience: ["employees", "dealers"],
    status: "recommended",
    description: "Модуль для сотрудников оптового направления.",
    readTimeMinutes: 40,
    progressPercent: 0,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["опт", "курс"],
    updatedAt: "18.04.2026",
    contentBlocks: [block("Цели", "Понимание ассортимента и сервисных стандартов компании.")],
  },
  {
    id: "tr-onboard-retail-staff",
    title: "Базовый курс сотрудника розницы",
    section: "onboarding",
    type: "course",
    audience: ["employees", "dealers"],
    status: "recommended",
    description: "Модуль для розничных точек партнёра.",
    readTimeMinutes: 38,
    progressPercent: 5,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["розница", "курс"],
    updatedAt: "19.04.2026",
    contentBlocks: [block("Фокус", "Витрина, консультация и передача заказа в обработку.")],
  },
  {
    id: "tr-reg-claims",
    title: "Рекламации: первичная обработка",
    section: "regulations",
    type: "regulation",
    audience: ["managers", "regional_managers", "purchasing"],
    status: "required",
    description: "Порядок фиксации обращения и сроки ответа.",
    readTimeMinutes: 16,
    progressPercent: 90,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["рекламации"],
    updatedAt: "03.05.2026",
    contentBlocks: [block("Этапы", "Регистрация, классификация, эскалация — без внутренних номеров заявок.")],
  },
  {
    id: "tr-reg-service",
    title: "Сервисные услуги: что важно уточнить",
    section: "regulations",
    type: "article",
    audience: ["managers", "dealers"],
    status: "updated",
    description: "Чек-лист уточнений перед оформлением сервиса.",
    readTimeMinutes: 9,
    progressPercent: 60,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["сервис"],
    updatedAt: "29.04.2026",
    contentBlocks: [block("Вопросы", "Список нейтральных вопросов к клиенту и фиксация ответов.")],
  },
  {
    id: "tr-reg-purchasing",
    title: "Закупки и актуальность ассортимента",
    section: "regulations",
    type: "regulation",
    audience: ["purchasing", "managers"],
    status: "recommended",
    description: "Согласование обновлений линейки.",
    readTimeMinutes: 13,
    progressPercent: 0,
    relatedProductIds: ["vh-kapelli"],
    relatedTaskIds: [],
    tags: ["закупки"],
    updatedAt: "25.04.2026",
    contentBlocks: [block("Процесс", "Кто инициирует обновление и как фиксируется решение.")],
  },
  {
    id: "tr-dev-door-facts",
    title: "Факты о дверях",
    section: "development",
    type: "article",
    audience: ["all"],
    status: "recommended",
    description: "Подборка проверенных фактов для разговора.",
    readTimeMinutes: 6,
    progressPercent: 0,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["факты"],
    updatedAt: "21.04.2026",
    contentBlocks: [block("Использование", "Как встроить факты в презентацию без перегрузки цифрами.")],
  },
  {
    id: "tr-dev-reading",
    title: "Список литературы для менеджера",
    section: "development",
    type: "article",
    audience: ["managers"],
    status: "new",
    description: "Рекомендованные издания и материалы для самостоятельного изучения.",
    readTimeMinutes: 5,
    progressPercent: 0,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["литература"],
    updatedAt: "06.05.2026",
    contentBlocks: [block("Примечание", "Список составлен из открытых источников и внутренних обзоров без ссылок на закрытые ресурсы.")],
  },
];

const _matrixTaskIds = getAllMatrixTasks()
  .slice(0, 2)
  .map((t) => t.taskId)
  .filter(Boolean);
const _linkMaterial = MATERIALS.find((m) => m.id === "tr-sales-expensive");
if (_linkMaterial && _matrixTaskIds.length > 0) {
  _linkMaterial.relatedTaskIds = [..._matrixTaskIds];
}

export function getAllTrainingMaterials(): TrainingMaterial[] {
  return MATERIALS;
}

export function getTrainingMaterialById(id: string): TrainingMaterial | undefined {
  return MATERIALS.find((m) => m.id === id);
}

export function getTrainingMaterialsForProduct(productId: string): TrainingMaterial[] {
  return MATERIALS.filter((m) => m.relatedProductIds.includes(productId));
}

export function summarizeTrainingKpis(materials: TrainingMaterial[]) {
  const total = materials.length;
  const required = materials.filter((m) => m.status === "required").length;
  const inProgress = materials.filter((m) => m.progressPercent > 0 && m.progressPercent < 100).length;
  const dealerAccess = materials.filter((m) => m.audience.includes("dealers") || m.audience.includes("all")).length;
  return { total, required, inProgress, dealerAccess };
}
