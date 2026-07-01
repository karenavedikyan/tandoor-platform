/**
 * Единое определение «без ответственного» для списков клиентов и ТТ (источник — флаги БД в строке).
 */

import type { DealerRow } from "./dealer-base-mock-data.js";

export type ResponsibleGap = "manager" | "regional" | "rop";

export interface ResponsibleFlags {
  hasManager: boolean;
  hasRegional: boolean;
  hasRop: boolean;
}

export function getResponsibleGaps(f: ResponsibleFlags): ResponsibleGap[] {
  const gaps: ResponsibleGap[] = [];
  if (!f.hasManager) gaps.push("manager");
  if (!f.hasRegional) gaps.push("regional");
  if (!f.hasRop) gaps.push("rop");
  return gaps;
}

export function isUnassigned(f: ResponsibleFlags): boolean {
  return getResponsibleGaps(f).length > 0;
}

export function toResponsibleFlags(row: {
  hasManager?: boolean;
  hasRegional?: boolean;
  hasRop?: boolean;
  regionalManagerId?: string | null;
  ropId?: string | null;
  managerUserId?: string | null;
}): ResponsibleFlags {
  return {
    hasManager: row.hasManager ?? Boolean(row.managerUserId),
    hasRegional: row.hasRegional ?? Boolean(row.regionalManagerId),
    hasRop: row.hasRop ?? Boolean(row.ropId),
  };
}

export function toResponsibleFlagsFromDealerRow(row: DealerRow): ResponsibleFlags {
  return toResponsibleFlags(row);
}
