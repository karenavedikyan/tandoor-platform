import {
  MATRIX_TASK_TYPE_LABEL,
  type MatrixTaskType,
  type MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";

export type TaskCategoryId = "showcase" | "documents" | "finance" | "logistics" | "training" | "crm" | "other";

export type TaskCategoryFilterId = TaskCategoryId | "all";

export type TaskCategoryMeta = {
  id: TaskCategoryId;
  label: string;
  shortLabel: string;
  /** Класс левой полоски карточки (border-l-4 + цвет). */
  borderLeftClass: string;
  /** Стили бейджа категории. */
  badgeClass: string;
  /** Стиль выбранного чипа. */
  chipActiveClass: string;
  chipInactiveClass: string;
};

export const TASK_CATEGORIES: TaskCategoryMeta[] = [
  {
    id: "showcase",
    label: "Витрина / Дистрибуция",
    shortLabel: "Витрина",
    borderLeftClass: "border-l-violet-500",
    badgeClass: "border-violet-300 bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-100",
    chipActiveClass: "border-violet-500 bg-violet-600 text-white",
    chipInactiveClass: "border-border bg-card text-muted-foreground hover:border-violet-400/60",
  },
  {
    id: "documents",
    label: "Документы",
    shortLabel: "Документы",
    borderLeftClass: "border-l-slate-600",
    badgeClass: "border-slate-300 bg-slate-50 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100",
    chipActiveClass: "border-slate-600 bg-slate-700 text-white",
    chipInactiveClass: "border-border bg-card text-muted-foreground hover:border-slate-400/60",
  },
  {
    id: "finance",
    label: "Финансы / Оплаты",
    shortLabel: "Финансы",
    borderLeftClass: "border-l-emerald-600",
    badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
    chipActiveClass: "border-emerald-600 bg-emerald-700 text-white",
    chipInactiveClass: "border-border bg-card text-muted-foreground hover:border-emerald-400/60",
  },
  {
    id: "logistics",
    label: "Логистика / Поставка",
    shortLabel: "Логистика",
    borderLeftClass: "border-l-orange-500",
    badgeClass: "border-orange-300 bg-orange-50 text-orange-950 dark:bg-orange-950/30 dark:text-orange-100",
    chipActiveClass: "border-orange-500 bg-orange-600 text-white",
    chipInactiveClass: "border-border bg-card text-muted-foreground hover:border-orange-400/60",
  },
  {
    id: "training",
    label: "Обучение / Сервис",
    shortLabel: "Обучение",
    borderLeftClass: "border-l-sky-600",
    badgeClass: "border-sky-300 bg-sky-50 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100",
    chipActiveClass: "border-sky-600 bg-sky-700 text-white",
    chipInactiveClass: "border-border bg-card text-muted-foreground hover:border-sky-400/60",
  },
  {
    id: "crm",
    label: "Коммуникация / CRM",
    shortLabel: "CRM",
    borderLeftClass: "border-l-indigo-600",
    badgeClass: "border-indigo-300 bg-indigo-50 text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-100",
    chipActiveClass: "border-indigo-600 bg-indigo-700 text-white",
    chipInactiveClass: "border-border bg-card text-muted-foreground hover:border-indigo-400/60",
  },
  {
    id: "other",
    label: "Другое",
    shortLabel: "Другое",
    borderLeftClass: "border-l-neutral-400",
    badgeClass: "border-border bg-muted/70 text-foreground",
    chipActiveClass: "border-neutral-600 bg-neutral-800 text-white",
    chipInactiveClass: "border-border bg-card text-muted-foreground hover:border-neutral-400/60",
  },
];

const TASK_CATEGORY_BY_ID: Record<TaskCategoryId, TaskCategoryMeta> = Object.fromEntries(
  TASK_CATEGORIES.map((c) => [c.id, c]),
) as Record<TaskCategoryId, TaskCategoryMeta>;

export type TaskClassification = {
  categoryId: TaskCategoryId;
};

const MATRIX_SHOWCASE_TYPES: MatrixTaskType[] = [
  "add_to_showcase",
  "check_presence",
  "update_photo",
  "approve_replacement",
  "maintain_showcase",
];

const DOC_KW = [
  "договор",
  "акт",
  "соглашение",
  "счёт",
  "счет",
  "реквизит",
  "документ",
  "подпис",
  "юрид",
  "эдо",
];

const FIN_KW = [
  "оплат",
  "задолжен",
  "сверк",
  " дз ",
  " дз,",
  "дз,",
  "возврат ден",
  "финанс",
  "платеж",
  "платёж",
  "кредит",
  "дебитор",
];

const LOG_KW = [
  "отгруз",
  "поставк",
  "доставк",
  "налич",
  "рекламац",
  "брак",
  "возврат тов",
  "логистик",
  "склад",
  "транспорт",
  "перемещ",
];

const TRAIN_KW = [
  "обучен",
  "тренинг",
  "продавц",
  "персонал",
  "презентац",
  "продуктов",
  "сервис",
  "инструктаж",
];

const CRM_KW = [
  "звонок",
  "визит",
  "follow",
  "реактивац",
  "связь",
  "контакт",
  " crm",
  "crm ",
  "встреч",
  "коммуникац",
];

const SHOWCASE_KW = [
  "витрин",
  "дистрибуц",
  "матриц",
  "экспозиц",
  "выкладк",
  "модел",
  "образц",
  "showcase",
  "portal",
  "зона a",
  "зона b",
];

function haystack(task: MatrixTaskWithContext): string {
  return [
    task.title,
    task.description,
    task.productName,
    task.productArticle,
    task.taskId,
    task.trainingProgramId ?? "",
    MATRIX_TASK_TYPE_LABEL[task.type],
    task.insightLabel ?? "",
    task.insightDomain ?? "",
    task.portal,
    `зона ${task.zone}`,
  ]
    .join(" ")
    .toLowerCase();
}

function containsAny(h: string, words: string[]): boolean {
  return words.some((w) => h.includes(w.trim().toLowerCase()));
}

/** Rule-based категория задачи для фильтров и чипов. */
export function classifyTask(task: MatrixTaskWithContext): TaskClassification {
  if (task.source === "showcase_distribution") {
    return { categoryId: "showcase" };
  }
  if (task.source === "product_training" || task.type === "product_training") {
    return { categoryId: "training" };
  }

  if (MATRIX_SHOWCASE_TYPES.includes(task.type)) {
    return { categoryId: "showcase" };
  }

  const h = haystack(task);

  if (task.insightDomain === "showcase") {
    return { categoryId: "showcase" };
  }
  if (task.insightDomain === "territory" || task.insightDomain === "analytics") {
    if (containsAny(h, CRM_KW)) return { categoryId: "crm" };
  }

  if (containsAny(h, DOC_KW)) return { categoryId: "documents" };
  if (containsAny(h, FIN_KW)) return { categoryId: "finance" };
  if (containsAny(h, LOG_KW)) return { categoryId: "logistics" };
  if (containsAny(h, TRAIN_KW)) return { categoryId: "training" };
  if (containsAny(h, CRM_KW)) return { categoryId: "crm" };
  if (containsAny(h, SHOWCASE_KW)) return { categoryId: "showcase" };

  return { categoryId: "other" };
}

export function getTaskCategoryMeta(categoryId: TaskCategoryId): TaskCategoryMeta {
  return TASK_CATEGORY_BY_ID[categoryId];
}

export function getTaskCategoryLabel(categoryId: TaskCategoryFilterId): string {
  if (categoryId === "all") return "Все типы";
  return TASK_CATEGORY_BY_ID[categoryId]?.label ?? categoryId;
}

export type TaskCategoryCounts = Record<TaskCategoryId, number> & { all: number };

export function getTaskCategoryCounts(tasks: MatrixTaskWithContext[]): TaskCategoryCounts {
  const base: Record<TaskCategoryId, number> = {
    showcase: 0,
    documents: 0,
    finance: 0,
    logistics: 0,
    training: 0,
    crm: 0,
    other: 0,
  };
  for (const t of tasks) {
    base[classifyTask(t).categoryId] += 1;
  }
  return { ...base, all: tasks.length };
}

export function filterTasksByCategory(
  tasks: MatrixTaskWithContext[],
  category: TaskCategoryFilterId,
): MatrixTaskWithContext[] {
  if (category === "all") return tasks;
  return tasks.filter((t) => classifyTask(t).categoryId === category);
}
