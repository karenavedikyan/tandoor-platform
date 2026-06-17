import type { MatrixTaskWithContext } from "./trade-point-task-data.js";
import { MATRIX_TASK_TYPE_LABEL } from "./trade-point-task-data.js";
import { classifyTask, type TaskClassification } from "./task-classification.js";

export type TaskPresetId = "all" | "urgent" | "showcase" | "training" | "overdue" | "rop_escalations";

export type TaskPresetMeta = {
  id: Exclude<TaskPresetId, "all">;
  label: string;
  shortLabel: string;
  description: string;
};

export const TASK_PRESETS: TaskPresetMeta[] = [
  {
    id: "urgent",
    label: "Мои горящие",
    shortLabel: "Горящие",
    description:
      "Не закрытые задачи с просрочкой, высоким приоритетом, сроком в ближайшие дни или пометкой срочности в тексте.",
  },
  {
    id: "showcase",
    label: "Витрины",
    shortLabel: "Витрины",
    description: "Активные задачи категории «Витрина / Дистрибуция».",
  },
  {
    id: "training",
    label: "Обучение",
    shortLabel: "Обучение",
    description: "Активные задачи категории «Обучение / Сервис».",
  },
  {
    id: "overdue",
    label: "Просроченные",
    shortLabel: "Просрочено",
    description: "Задачи со статусом просрочки, просроченным сроком в дате или явной отметкой в тексте.",
  },
  {
    id: "rop_escalations",
    label: "Эскалации РОПа",
    shortLabel: "Эскалации",
    description:
      "Задачи с признаками эскалации на уровень РОПа: формулировки в тексте или зона ответственности регионального менеджера при высоком приоритете или просрочке.",
  },
];

const URGENT_TEXT = ["срочно", "просроч", "критич", "важно", "требует внимания"];

function notDone(t: MatrixTaskWithContext): boolean {
  return t.status !== "done";
}

/** Парсинг даты вида DD.MM.YYYY в локальной полуночи. */
function parseRuDueDate(s: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]) - 1;
  const yy = Number(m[3]);
  const d = new Date(yy, mm, dd);
  if (d.getFullYear() !== yy || d.getMonth() !== mm || d.getDate() !== dd) return null;
  return d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
}

function textHaystack(t: MatrixTaskWithContext): string {
  return [
    t.title,
    t.description,
    t.insightLabel ?? "",
    MATRIX_TASK_TYPE_LABEL[t.type],
  ]
    .join(" ")
    .toLowerCase();
}

function hasUrgentText(t: MatrixTaskWithContext): boolean {
  const h = textHaystack(t);
  return URGENT_TEXT.some((w) => h.includes(w));
}

function isDueWithinNextDays(t: MatrixTaskWithContext, days: number, now: Date): boolean {
  const due = parseRuDueDate(t.dueDate);
  if (!due) return false;
  const today = startOfDay(now);
  const end = addDays(today, days);
  return due >= today && due <= end;
}

function isPastDueNotDone(t: MatrixTaskWithContext, now: Date): boolean {
  if (t.status === "done") return false;
  const due = parseRuDueDate(t.dueDate);
  if (!due) return false;
  return startOfDay(due) < startOfDay(now);
}

function matchesOverduePreset(t: MatrixTaskWithContext, now: Date): boolean {
  if (!notDone(t)) return false;
  if (t.status === "overdue") return true;
  const h = textHaystack(t);
  if (h.includes("просроч")) return true;
  return isPastDueNotDone(t, now);
}

function matchesUrgentPreset(t: MatrixTaskWithContext, now: Date): boolean {
  if (!notDone(t)) return false;
  if (t.status === "overdue") return true;
  if (t.priority === "high") return true;
  if (isDueWithinNextDays(t, 3, now)) return true;
  if (hasUrgentText(t)) return true;
  return false;
}

function matchesRopEscalationPreset(t: MatrixTaskWithContext): boolean {
  const h = [
    t.title,
    t.description,
    t.insightLabel ?? "",
    MATRIX_TASK_TYPE_LABEL[t.type],
  ]
    .join(" ")
    .toLowerCase();
  if (h.includes("эскалац")) return true;
  if (h.includes("руководител")) return true;
  const ropHints = [" роп ", " роп,", " роп.", " роп)", " роп:", "(роп", "роп)", "к роп", "у роп", "от роп"];
  if (ropHints.some((x) => h.includes(x))) return true;
  if (h.startsWith("роп ") || h.startsWith("роп,")) return true;
  if (t.assigneeRole === "regional_manager" && (t.priority === "high" || t.status === "overdue")) return true;
  return false;
}

/**
 * Проверка попадания задачи в пресет. Для showcase/training использует classification при передаче,
 * иначе вызывает classifyTask.
 */
export function taskMatchesPreset(
  task: MatrixTaskWithContext,
  presetId: TaskPresetId,
  classification?: TaskClassification,
  now: Date = new Date(),
): boolean {
  if (presetId === "all") return true;

  const c = classification ?? classifyTask(task);

  switch (presetId) {
    case "urgent":
      return matchesUrgentPreset(task, now);
    case "showcase":
      return notDone(task) && c.categoryId === "showcase";
    case "training":
      return notDone(task) && c.categoryId === "training";
    case "overdue":
      return matchesOverduePreset(task, now);
    case "rop_escalations":
      return notDone(task) && matchesRopEscalationPreset(task);
    default:
      return true;
  }
}

export function filterTasksByPreset(
  tasks: MatrixTaskWithContext[],
  presetId: TaskPresetId,
  now?: Date,
): MatrixTaskWithContext[] {
  if (presetId === "all") return tasks;
  const ref = now ?? new Date();
  return tasks.filter((t) => taskMatchesPreset(t, presetId, undefined, ref));
}

export type TaskPresetCounts = Record<TaskPresetId, number>;

export function getTaskPresetCounts(tasks: MatrixTaskWithContext[], now?: Date): TaskPresetCounts {
  const ref = now ?? new Date();
  const out: TaskPresetCounts = {
    all: tasks.length,
    urgent: 0,
    showcase: 0,
    training: 0,
    overdue: 0,
    rop_escalations: 0,
  };
  for (const t of tasks) {
    const c = classifyTask(t);
    if (taskMatchesPreset(t, "urgent", c, ref)) out.urgent += 1;
    if (taskMatchesPreset(t, "showcase", c, ref)) out.showcase += 1;
    if (taskMatchesPreset(t, "training", c, ref)) out.training += 1;
    if (taskMatchesPreset(t, "overdue", c, ref)) out.overdue += 1;
    if (taskMatchesPreset(t, "rop_escalations", c, ref)) out.rop_escalations += 1;
  }
  return out;
}

/** Для бейджа «Просрочена» на карточке. */
export function taskMatchesOverduePresetForBadge(task: MatrixTaskWithContext, now?: Date): boolean {
  return taskMatchesPreset(task, "overdue", undefined, now ?? new Date());
}

/** Для бейджа «Горящая»: срочная по правилам пресета, но без отдельного кейса просрочки (тот показывается отдельно). */
export function taskMatchesUrgentPresetForBadge(task: MatrixTaskWithContext, now?: Date): boolean {
  const ref = now ?? new Date();
  if (taskMatchesOverduePresetForBadge(task, ref)) return false;
  return taskMatchesPreset(task, "urgent", undefined, ref);
}

export function getTaskPresetLabel(presetId: TaskPresetId): string {
  if (presetId === "all") return "Все задачи";
  return TASK_PRESETS.find((p) => p.id === presetId)?.label ?? presetId;
}
