/**
 * Локальные обезличенные материалы раздела «Обучение / База знаний».
 * Структура отражает потоки корпоративной Wiki; импорт и URL закрытой Wiki не используются.
 */

import { getAllMatrixTasks, type TaskInsightDomain } from "./trade-point-task-data";

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

/** Ключ раздела базы знаний (совпадает с разделом материала). */
export type TrainingSectionKey = TrainingSection;

/** Роль получателя в учебном центре. */
export type TrainingRole = "manager" | "regional_manager" | "leadership" | "new_hire";

export type TrainingProgramLevel = "basic" | "advanced" | "expert";

export type TrainingProgramStatus = "not_started" | "in_progress" | "completed" | "overdue";

export type TrainingProgressStatus = "not_started" | "in_progress" | "completed";

export const TRAINING_PROGRESS_STATUS_LABEL: Record<TrainingProgressStatus, string> = {
  not_started: "Не начато",
  in_progress: "В работе",
  completed: "Завершено",
};

export type RelatedTaskContext = "showcase" | "hardware" | "orders" | "dealer_card" | "territory" | "analytics";

export type TrainingProgram = {
  id: string;
  title: string;
  description: string;
  section: TrainingSectionKey;
  role: TrainingRole;
  level: TrainingProgramLevel;
  durationMinutes: number;
  required: boolean;
  progressPercent: number;
  completedMaterials: number;
  totalMaterials: number;
  status: TrainingProgramStatus;
  materialIds: string[];
  relatedProductCategory: "mk" | "vh" | "hardware" | "all" | null;
  coverTone: "lime" | "slate" | "sky" | "amber" | "violet";
};

export type TrainingModule = {
  id: string;
  programId: string;
  title: string;
  order: number;
  materialIds: string[];
};

export type TrainingProgress = {
  monthProgressPercent: number;
  requiredCompleted: number;
  requiredTotal: number;
  inProgressCount: number;
  attentionCount: number;
};

export type TrainingAssignment = {
  id: string;
  materialId: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  status: TrainingProgressStatus;
};

export type TrainingMaterialDifficulty = "easy" | "medium" | "hard";

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
  programIds: string[];
  durationMinutes: number;
  difficulty: TrainingMaterialDifficulty;
  required: boolean;
  progressStatus: TrainingProgressStatus;
  knowledgeTags: string[];
  relatedTaskContext: RelatedTaskContext[];
  checklist: string[];
  summaryBullets: string[];
};

const block = (heading: string, body: string) => ({ heading, body });

export const TRAINING_ROLE_LABEL: Record<TrainingRole, string> = {
  manager: "Менеджер",
  regional_manager: "Региональный менеджер",
  leadership: "Руководитель",
  new_hire: "Новый сотрудник",
};

export const TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    id: "prog-product-lines",
    title: "Продуктовая база: двери в диалоге",
    description: "Линейки МК и ВХ, материалы полотна и фурнитура — единый цикл для консультации.",
    section: "product",
    role: "manager",
    level: "basic",
    durationMinutes: 95,
    required: true,
    progressPercent: 38,
    completedMaterials: 2,
    totalMaterials: 5,
    status: "in_progress",
    materialIds: ["tr-prod-ent-card", "tr-prod-int-coatings", "tr-prod-hw-groups", "tr-prod-materials-mdf", "tr-prod-metal-qr"],
    relatedProductCategory: "mk",
    coverTone: "lime",
  },
  {
    id: "prog-sales-hits",
    title: "Техника продаж: ключевые сценарии",
    description: "Возражения, звонки, сравнение моделей и оптовый контекст.",
    section: "sales",
    role: "manager",
    level: "basic",
    durationMinutes: 52,
    required: true,
    progressPercent: 22,
    completedMaterials: 1,
    totalMaterials: 4,
    status: "in_progress",
    materialIds: ["tr-sales-expensive", "tr-sales-call", "tr-sales-wholesale", "tr-sales-compare-models"],
    relatedProductCategory: "all",
    coverTone: "sky",
  },
  {
    id: "prog-adapt-2026",
    title: "Адаптация и первые шаги",
    description: "Онбординг для новых сотрудников и базовые курсы каналов.",
    section: "onboarding",
    role: "new_hire",
    level: "basic",
    durationMinutes: 120,
    required: true,
    progressPercent: 8,
    completedMaterials: 0,
    totalMaterials: 3,
    status: "in_progress",
    materialIds: ["tr-onboard-manager", "tr-onboard-wholesale-staff", "tr-onboard-retail-staff"],
    relatedProductCategory: null,
    coverTone: "amber",
  },
  {
    id: "prog-regional-control",
    title: "Регламенты и контроль качества",
    description: "Рекламации, сервис и закупки — для регионального контура.",
    section: "regulations",
    role: "regional_manager",
    level: "advanced",
    durationMinutes: 45,
    required: false,
    progressPercent: 72,
    completedMaterials: 2,
    totalMaterials: 3,
    status: "in_progress",
    materialIds: ["tr-reg-claims", "tr-reg-service", "tr-reg-purchasing"],
    relatedProductCategory: "hardware",
    coverTone: "slate",
  },
];

export const TRAINING_MODULES: TrainingModule[] = [
  { id: "mod-pl-intro", programId: "prog-product-lines", title: "Карточка модели и покрытия", order: 1, materialIds: ["tr-prod-ent-card", "tr-prod-int-coatings"] },
  { id: "mod-pl-deep", programId: "prog-product-lines", title: "Материалы и фурнитура", order: 2, materialIds: ["tr-prod-materials-mdf", "tr-prod-hw-groups", "tr-prod-metal-qr"] },
  { id: "mod-sl-core", programId: "prog-sales-hits", title: "Скрипты и аргументация", order: 1, materialIds: ["tr-sales-expensive", "tr-sales-call", "tr-sales-wholesale"] },
  { id: "mod-sl-adv", programId: "prog-sales-hits", title: "Сравнение и видео", order: 2, materialIds: ["tr-sales-compare-models"] },
  { id: "mod-ad-weeks", programId: "prog-adapt-2026", title: "Две недели старта", order: 1, materialIds: ["tr-onboard-manager", "tr-onboard-wholesale-staff", "tr-onboard-retail-staff"] },
  { id: "mod-rg-set", programId: "prog-regional-control", title: "Регламенты сервиса", order: 1, materialIds: ["tr-reg-claims", "tr-reg-service", "tr-reg-purchasing"] },
];

export const TRAINING_ASSIGNMENTS: TrainingAssignment[] = [
  { id: "asn-claims", materialId: "tr-reg-claims", title: "Завершить блок «Рекламации»", priority: "high", dueDate: "12.05.2026", status: "in_progress" },
  { id: "asn-expensive", materialId: "tr-sales-expensive", title: "Повторить скрипт возражения «дорого»", priority: "high", dueDate: "15.05.2026", status: "in_progress" },
  { id: "asn-vh-card", materialId: "tr-prod-ent-card", title: "Изучить карточку входной группы", priority: "medium", dueDate: "20.05.2026", status: "not_started" },
  { id: "asn-hw", materialId: "tr-prod-hw-groups", title: "Фурнитура: группы и аргументы", priority: "medium", dueDate: "22.05.2026", status: "not_started" },
  { id: "asn-onboard", materialId: "tr-onboard-manager", title: "Модуль адаптации менеджера", priority: "low", dueDate: "28.05.2026", status: "in_progress" },
];

type LegacyTrainingMaterial = Omit<
  TrainingMaterial,
  | "programIds"
  | "durationMinutes"
  | "difficulty"
  | "required"
  | "progressStatus"
  | "knowledgeTags"
  | "relatedTaskContext"
  | "checklist"
  | "summaryBullets"
>;

export const TRAINING_PROGRAM_LEVEL_LABEL: Record<TrainingProgramLevel, string> = {
  basic: "Базовый",
  advanced: "Продвинутый",
  expert: "Экспертный",
};

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

const _RAW_MATERIALS: LegacyTrainingMaterial[] = [
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

function programIdsForMaterial(id: string): string[] {
  return TRAINING_PROGRAMS.filter((p) => p.materialIds.includes(id)).map((p) => p.id);
}

function contextsFor(m: LegacyTrainingMaterial): RelatedTaskContext[] {
  const c: RelatedTaskContext[] = [];
  if (m.section === "product") {
    c.push("showcase", "hardware", "dealer_card");
  }
  if (m.section === "sales") {
    c.push("analytics", "dealer_card");
  }
  if (m.section === "regulations") {
    c.push("orders", "territory", "dealer_card");
  }
  if (m.section === "onboarding") {
    c.push("dealer_card", "orders");
  }
  if (m.section === "development") {
    c.push("analytics");
  }
  if (m.relatedTaskIds.length > 0) {
    c.push("showcase");
  }
  return Array.from(new Set(c));
}

function difficultyFor(m: LegacyTrainingMaterial): TrainingMaterialDifficulty {
  if (m.readTimeMinutes >= 25 || m.type === "regulation") return "hard";
  if (m.readTimeMinutes <= 8) return "easy";
  return "medium";
}

function progressStatusFor(pct: number): TrainingProgressStatus {
  if (pct >= 100) return "completed";
  if (pct > 0) return "in_progress";
  return "not_started";
}

function enrichTrainingMaterial(m: LegacyTrainingMaterial): TrainingMaterial {
  const bullets = [m.description.slice(0, 160)];
  if (m.contentBlocks[0]) bullets.push(m.contentBlocks[0]!.body.slice(0, 160));
  return {
    ...m,
    programIds: programIdsForMaterial(m.id),
    durationMinutes: m.readTimeMinutes,
    difficulty: difficultyFor(m),
    required: m.status === "required",
    progressStatus: progressStatusFor(m.progressPercent),
    knowledgeTags: [...m.tags],
    relatedTaskContext: contextsFor(m),
    checklist: [
      "Просмотреть материал и зафиксировать вопросы",
      m.section === "product"
        ? "Сверить с выкладкой или задачей по точке"
        : "Применить на ближайшем клиентском кейсе",
      "Отметить результат в рабочем списке",
    ],
    summaryBullets: bullets,
  };
}

const MATERIALS: TrainingMaterial[] = _RAW_MATERIALS.map(enrichTrainingMaterial);

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
  const required = materials.filter((m) => m.required).length;
  const inProgress = materials.filter((m) => m.progressPercent > 0 && m.progressPercent < 100).length;
  const dealerAccess = materials.filter((m) => m.audience.includes("dealers") || m.audience.includes("all")).length;
  return { total, required, inProgress, dealerAccess };
}

export function getTrainingDashboardSummary(): TrainingProgress {
  const mats = MATERIALS;
  const req = mats.filter((m) => m.required);
  const reqDone = req.filter((m) => m.progressStatus === "completed").length;
  const inProg = mats.filter((m) => m.progressStatus === "in_progress").length;
  const attention = TRAINING_ASSIGNMENTS.filter((a) => a.priority === "high" && a.status !== "completed").length;
  const monthPct = Math.min(100, Math.round(mats.reduce((s, m) => s + m.progressPercent, 0) / Math.max(1, mats.length)));
  return {
    monthProgressPercent: monthPct,
    requiredCompleted: reqDone,
    requiredTotal: req.length,
    inProgressCount: inProg,
    attentionCount: attention,
  };
}

export function getTrainingPrograms(): TrainingProgram[] {
  return TRAINING_PROGRAMS;
}

export function getTrainingProgramById(programId: string): TrainingProgram | undefined {
  return TRAINING_PROGRAMS.find((p) => p.id === programId);
}

export function getTrainingMaterialsByProgram(programId: string): TrainingMaterial[] {
  const p = getTrainingProgramById(programId);
  if (!p) return [];
  return p.materialIds
    .map((id) => getTrainingMaterialById(id))
    .filter((m): m is TrainingMaterial => Boolean(m));
}

export function getRequiredTrainingMaterials(): TrainingMaterial[] {
  return MATERIALS.filter((m) => m.required);
}

export function getRecommendedTrainingMaterials(): TrainingMaterial[] {
  return MATERIALS.filter((m) => !m.required && (m.status === "recommended" || m.status === "new"));
}

export function getTrainingAssignments(): TrainingAssignment[] {
  return TRAINING_ASSIGNMENTS;
}

export function getTrainingProgramsForMaterial(materialId: string): TrainingProgram[] {
  return TRAINING_PROGRAMS.filter((p) => p.materialIds.includes(materialId));
}

export function getTrainingProgramsForProduct(productId: string): TrainingProgram[] {
  const mats = getTrainingMaterialsForProduct(productId);
  const ids = new Set(mats.flatMap((m) => m.programIds));
  return TRAINING_PROGRAMS.filter((p) => ids.has(p.id));
}

export function getTrainingMaterialsBySection(section: TrainingSection): TrainingMaterial[] {
  return MATERIALS.filter((m) => m.section === section);
}

export function getTrainingModulesByProgram(programId: string): TrainingModule[] {
  return TRAINING_MODULES.filter((mod) => mod.programId === programId).sort((a, b) => a.order - b.order);
}

export type TrainingMaterialSearchFilters = {
  section?: TrainingSection | "all";
  role?: TrainingRole | "all";
  type?: TrainingMaterialType | "all";
  required?: "all" | "required" | "optional";
  progressStatus?: TrainingProgressStatus | "all";
};

function materialMatchesRole(m: TrainingMaterial, role: TrainingRole): boolean {
  if (role === "manager") return m.audience.includes("managers") || m.audience.includes("all");
  if (role === "regional_manager") return m.audience.includes("regional_managers") || m.audience.includes("all");
  if (role === "leadership") return m.audience.includes("managers") || m.audience.includes("regional_managers");
  if (role === "new_hire") return m.audience.includes("employees") || m.audience.includes("managers");
  return true;
}

export function searchTrainingMaterials(query: string, filters: TrainingMaterialSearchFilters): TrainingMaterial[] {
  const q = query.trim().toLowerCase();
  return MATERIALS.filter((m) => {
    if (q) {
      const hit =
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.knowledgeTags.some((t) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (filters.section && filters.section !== "all" && m.section !== filters.section) return false;
    if (filters.role && filters.role !== "all" && !materialMatchesRole(m, filters.role)) return false;
    if (filters.type && filters.type !== "all" && m.type !== filters.type) return false;
    if (filters.required === "required" && !m.required) return false;
    if (filters.required === "optional" && m.required) return false;
    if (filters.progressStatus && filters.progressStatus !== "all" && m.progressStatus !== filters.progressStatus) {
      return false;
    }
    return true;
  });
}

export const RELATED_TASK_CONTEXT_LABEL: Record<RelatedTaskContext, string> = {
  showcase: "Витрина",
  hardware: "Фурнитура",
  orders: "Заказы",
  dealer_card: "Карточка клиента",
  territory: "Карточка территории",
  analytics: "Аналитика",
};

export function getTrainingArticleIdForTask(params: {
  insightDomain?: TaskInsightDomain;
  productId?: string;
}): string | undefined {
  if (params.productId) {
    const byProd = getTrainingMaterialsForProduct(params.productId);
    if (byProd[0]) return byProd[0].id;
  }
  switch (params.insightDomain) {
    case "analytics":
      return "tr-sales-expensive";
    case "showcase":
      return "tr-prod-ent-card";
    case "hardware":
      return "tr-prod-hw-groups";
    case "equipment":
      return "tr-reg-service";
    case "territory":
      return "tr-reg-claims";
    default:
      return undefined;
  }
}
