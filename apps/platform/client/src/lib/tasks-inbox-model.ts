import type { AssignmentDto, AssignmentStatus } from "@/lib/showcase-assignments-api";

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
