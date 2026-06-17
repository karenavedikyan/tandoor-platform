import type { AssignmentDto, AssignmentStatus } from "./showcase-assignments-api.js";

export type TaskSource = "showcase_assignment";
export type TaskDirection = "incoming" | "outgoing";

export type UnifiedTask = {
  id: string;
  source: TaskSource;
  entityId: string;
  direction: TaskDirection;
  title: string;
  status: AssignmentStatus;
  dueDate: string | null;
  counterpartyName: string | null;
  assigneeName: string | null;
  createdById: string | null;
  comment: string | null;
  isArchived: boolean;
  progressLabel: string | null;
  href: string;
  createdAt: string;
  updatedAt: string;
};

export function assignmentProgressLabel(dto: AssignmentDto): string | null {
  if (dto.itemsTotal <= 0) return null;
  const shipped = `${dto.itemsDone} / ${dto.itemsTotal} отгружено`;
  if (dto.itemsVerified > 0) {
    return `${shipped} · ${dto.itemsVerified} на витрине`;
  }
  return shipped;
}

export function assignmentToUnifiedTask(
  dto: AssignmentDto,
  direction: TaskDirection,
  _currentUserId: string,
): UnifiedTask {
  const title = dto.title?.trim() || "Задание на отгрузку";
  const counterpartyName =
    direction === "incoming"
      ? dto.createdByName?.trim() || null
      : dto.assigneeName?.trim() || null;

  return {
    id: `showcase_assignment:${dto.id}`,
    source: "showcase_assignment",
    entityId: dto.id,
    direction,
    title,
    status: dto.status,
    dueDate: dto.dueDate,
    counterpartyName,
    assigneeName: dto.assigneeName?.trim() || null,
    createdById: dto.createdBy,
    comment: dto.comment,
    isArchived: dto.isArchived,
    progressLabel: assignmentProgressLabel(dto),
    href: `/assignment/${dto.id}`,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export type TaskStatusFilter = "all" | "open" | "submitted" | "completed";

export function filterUnifiedTasksByStatus(tasks: UnifiedTask[], filter: TaskStatusFilter): UnifiedTask[] {
  if (filter === "all") return tasks;
  if (filter === "open") {
    return tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  }
  if (filter === "submitted") {
    return tasks.filter((t) => t.status === "submitted");
  }
  return tasks.filter((t) => t.status === "verified" || t.status === "closed");
}

export type TaskFilters = {
  text?: string;
  assignee?: string;
  dueFrom?: string;
  dueTo?: string;
  overdueOnly?: boolean;
};

function isTaskOverdue(task: UnifiedTask): boolean {
  if (!task.dueDate || task.status === "verified" || task.status === "closed") return false;
  return task.dueDate < new Date().toISOString().slice(0, 10);
}

export function applyTaskFilters(tasks: UnifiedTask[], filters: TaskFilters): UnifiedTask[] {
  let out = tasks;
  const text = filters.text?.trim().toLowerCase();
  if (text) {
    out = out.filter((t) => {
      const hay = `${t.title} ${t.counterpartyName ?? ""}`.toLowerCase();
      return hay.includes(text);
    });
  }
  const assignee = filters.assignee?.trim().toLowerCase();
  if (assignee) {
    out = out.filter((t) => {
      const name = (t.assigneeName ?? t.counterpartyName ?? "").toLowerCase();
      return name.includes(assignee);
    });
  }
  if (filters.overdueOnly) {
    out = out.filter(isTaskOverdue);
  }
  if (filters.dueFrom) {
    out = out.filter((t) => t.dueDate != null && t.dueDate >= filters.dueFrom!);
  }
  if (filters.dueTo) {
    out = out.filter((t) => t.dueDate != null && t.dueDate <= filters.dueTo!);
  }
  return out;
}
