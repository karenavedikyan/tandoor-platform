/**
 * Видимость клиентов в клиентской базе с учётом актуализации (Промт 349).
 */
import type { DealerStatus } from "./dealer-base-mock-data.js";
import type { ActualizationState } from "./client-base-actualization-state.js";
import type { ReleaseClient } from "./release-client-data.js";
import type { TrashedDealerInfo } from "./client-base-actualization-state.js";
import { getManualDealerDisplayCode } from "./client-base-actualization-stable-ids.js";

function fieldStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Есть ли у клиента следы менеджерской актуализации (override, контакты, юрлица и т.д.). */
export function hasManagerActualization(clientId: string, act: ActualizationState | null | undefined): boolean {
  if (!act || !clientId) return false;
  if (act.dealerOverridesById?.[clientId]) return true;
  if (act.legalEntityOverridesByDealerId?.[clientId]) return true;
  if (act.dealerActualizationAuditByDealerId?.[clientId]) return true;
  const photos = act.dealerPhotosByDealerId?.[clientId];
  if (photos && photos.length > 0) return true;
  for (const contact of Object.values(act.dealerActualizationContactsById ?? {})) {
    if (contact.dealerId === clientId) return true;
  }
  return false;
}

export function dealerStatusFromPassportLifecycle(lifecycle: string): DealerStatus {
  if (lifecycle === "needs_review") return "требует внимания";
  if (lifecycle === "inactive" || lifecycle === "archived") return "приостановлен";
  return "активный";
}

/** Закрытый seed-клиент остаётся в выдаче, если менеджер его актуализировал. */
export function releaseClientVisibleDespiteClosed(
  client: Pick<ReleaseClient, "id" | "isClosed">,
  act: ActualizationState | null | undefined,
): boolean {
  return client.isClosed === true && hasManagerActualization(client.id, act);
}

export function resolveSeedDealerIdByReleaseCode(
  releaseCode: string,
  releaseByCode: ReadonlyMap<string, string>,
): string | undefined {
  const code = releaseCode.trim();
  if (!code) return undefined;
  return releaseByCode.get(code);
}

export function buildReleaseCodeToDealerIdMap(
  rows: ReadonlyArray<{ id: string; releaseCode?: string }>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    const code = r.releaseCode?.trim();
    if (code) m.set(code, r.id);
  }
  return m;
}

export function isDealerTrashedOrArchivedInScope(
  dealerId: string,
  act: ActualizationState,
  ignoreArchive = false,
): boolean {
  if (act.trashedDealersById?.[dealerId]) return true;
  if (!ignoreArchive && act.archivedDealersById?.[dealerId]) return true;
  return false;
}

/**
 * Manual-дилер с external1cCode показывается отдельной строкой, если seed по коду
 * скрыт в корзине/архиве — иначе данные «теряются» при склейке с невидимым seed.
 */
export function manualDealerShouldShowSeparateFromLinkedSeed(
  external1cCode: string | undefined,
  act: ActualizationState,
  releaseByCode: ReadonlyMap<string, string>,
  ignoreArchive = false,
): boolean {
  const code = external1cCode?.trim();
  if (!code) return true;
  const seedId = releaseByCode.get(code);
  if (!seedId) return true;
  return isDealerTrashedOrArchivedInScope(seedId, act, ignoreArchive);
}

export type TrashedDealerDisplay = {
  info: TrashedDealerInfo;
  dealerId: string;
  name: string;
  city: string;
  inn: string;
  dealerCode: string;
};

/** Имя/код для строки корзины: snapshot → seed → manual → код/id. */
export function resolveTrashedDealerDisplayName(
  info: TrashedDealerInfo,
  state: ActualizationState,
  releaseById: Map<string, ReleaseClient>,
): TrashedDealerDisplay {
  const dealerId = info.dealerId;
  const manual = state.manuallyCreatedDealersById?.[dealerId];
  const override = state.dealerOverridesById?.[dealerId];
  const fields = { ...(override?.fields ?? {}), ...(manual?.fields ?? {}) };
  const release = releaseById.get(dealerId);
  const snapshotName = fieldStr(info.snapshot.fullName);
  const snapshotCode = fieldStr(info.snapshot.dealerCode);
  const fieldName = fieldStr(fields.name) || fieldStr(fields.dealerName);
  const releaseName = release?.name?.trim() ?? "";
  const manualName =
    manual && dealerId !== release?.id
      ? fieldStr(manual.fields?.name) || fieldStr((manual.fields as Record<string, unknown>)?.dealerName)
      : "";
  const releaseCode = release?.code?.trim() || fieldStr(fields.external1cCode) || "";
  const dealerCode =
    manual?.internalCode?.trim() || (manual ? getManualDealerDisplayCode(manual) : "") || releaseCode;
  const name =
    snapshotName ||
    fieldName ||
    releaseName ||
    manualName ||
    releaseCode ||
    snapshotCode ||
    dealerCode ||
    dealerId;
  const city = fieldStr(info.snapshot.city) || fieldStr(fields.city) || release?.city?.trim() || "—";
  const inn = fieldStr(info.snapshot.inn) || fieldStr(fields.inn) || "—";
  const code = snapshotCode || dealerCode || releaseCode || dealerId;
  return { info, dealerId, name, city, inn, dealerCode: code };
}
