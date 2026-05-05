/**
 * Конфигурация preview-режима: текущий этап, видимость модулей, внутренние маршруты прототипа.
 * Не содержит секретов и реальных данных.
 */

export type ModuleVisibilityStatus =
  | "internal_prototype"
  | "preview"
  | "beta"
  | "production"
  | "planned";

export const PREVIEW_MODE_ENABLED = true;

export const CURRENT_PREVIEW_STAGE = {
  id: "dealer-card-foundation",
  title: "Единая карточка дилера",
  status: "preview" as const,
  description:
    "Первый публичный этап платформы: объединение данных о дилере из 1С, Bitrix, Bitrix24, Excel и Google-источников.",
} as const;

export const MODULE_VISIBILITY: Record<string, ModuleVisibilityStatus> = {
  client_base: "preview",
  dealer_card: "preview",
  data_sources: "preview",
  integrations: "preview",
  sales_department: "internal_prototype",
  regional_manager: "internal_prototype",
  sales_tasks: "internal_prototype",
  showcase_goals: "internal_prototype",
  orders: "internal_prototype",
  claims: "internal_prototype",
  catalog: "internal_prototype",
  knowledge_base: "planned",
  learning: "planned",
  documents: "planned",
  admin: "planned",
};

/** Маршруты внутреннего прототипа: сохраняются для команды, не показываются в публичной навигации. */
export const INTERNAL_PROTOTYPE_ROUTES: readonly string[] = [
  "/sales-department",
  "/regional-manager/workspace",
  "/dealers",
  "/catalog",
  "/orders",
  "/claims",
  "/events",
  "/import",
  "/goals",
  "/leadership",
] as const;

export function isModuleVisibleInPreview(moduleId: string): boolean {
  const s = MODULE_VISIBILITY[moduleId];
  if (!s) return false;
  return s === "preview" || s === "beta" || s === "production";
}

export function getModuleStatusLabel(status: ModuleVisibilityStatus): string {
  switch (status) {
    case "internal_prototype":
      return "Внутренний прототип";
    case "preview":
      return "Preview";
    case "beta":
      return "Бета";
    case "production":
      return "Production";
    case "planned":
      return "Запланировано";
    default:
      return status;
  }
}

export type StatusTone = "lime" | "muted" | "amber" | "blue";

export function getModuleStatusTone(status: ModuleVisibilityStatus): StatusTone {
  switch (status) {
    case "preview":
    case "production":
      return "lime";
    case "beta":
      return "amber";
    case "internal_prototype":
      return "muted";
    case "planned":
      return "blue";
    default:
      return "muted";
  }
}
