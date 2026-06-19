/**
 * Промт 417: единственное место, где описано «что такое active / in_trash / pending_admin».
 * Использовать ВЕЗДЕ. Никаких локальных копий, никаких OR-комбинаций по timestamp-полям.
 */

export type RecordStatus = "active" | "in_trash" | "pending_admin" | "purged";

/** dealer_overrides alias */
export const dealerStatusActive = (alias = "d_ov") => `${alias}.status = 'active'`;
export const dealerStatusTrash = (alias = "d_ov") => `${alias}.status = 'in_trash'`;
export const dealerStatusPendingAdmin = (alias = "d_ov") => `${alias}.status = 'pending_admin'`;
export const dealerStatusVisible = (alias = "d_ov") => `${alias}.status <> 'purged'`;

/** LEFT JOIN dealer_overrides: отсутствие строки оверрайда ≡ active */
export const dealerJoinStatusActive = (alias = "d_ov") =>
  `(${alias}.dealer_id IS NULL OR ${alias}.status = 'active')`;

/** trade_point_overrides alias */
export const tpStatusActive = (alias = "tpo") => `${alias}.status = 'active'`;
export const tpStatusTrash = (alias = "tpo") => `${alias}.status = 'in_trash'`;
export const tpStatusPendingAdmin = (alias = "tpo") => `${alias}.status = 'pending_admin'`;
export const tpStatusVisible = (alias = "tpo") => `${alias}.status <> 'purged'`;

/** LEFT JOIN trade_point_overrides: отсутствие строки оверрайда ≡ active */
export const tpJoinStatusActive = (alias = "tpo") =>
  `(${alias}.tp_id IS NULL OR ${alias}.status = 'active')`;

export function parseRecordStatus(raw: unknown): RecordStatus {
  if (raw === "active" || raw === "in_trash" || raw === "pending_admin" || raw === "purged") {
    return raw;
  }
  return "active";
}

export function isEmployeeTrashStatus(status: RecordStatus | null | undefined): boolean {
  return status === "in_trash";
}

export function isPendingAdminStatus(status: RecordStatus | null | undefined): boolean {
  return status === "pending_admin";
}

export function isPurgedStatus(status: RecordStatus | null | undefined): boolean {
  return status === "purged";
}
