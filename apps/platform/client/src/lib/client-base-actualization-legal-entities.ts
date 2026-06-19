/**
 * Юрлица в актуализации: стабильные id, коды TND-LE-*, архив и восстановление.
 */

import type { ActualizationSource, ActualizationState, ArchivedLegalEntityInfo } from "./client-base-actualization-state.js";
import { mergeActualizationState } from "./client-base-actualization-state.js";

const DISPLAY_CODE_RE = /^TND-LE-(\d{6})$/i;

function pad6(n: number): string {
  const s = String(Math.max(0, Math.floor(n)));
  return s.length >= 6 ? s.slice(-6) : "0".repeat(6 - s.length) + s;
}

/** Стабильный технический id (один раз при создании записи). */
export function generateManualLegalEntityStableId(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  const rnd = Math.random().toString(36).slice(2, 10);
  return `manual-legal-entity-${stamp}-${rnd}`;
}

function maxDisplayCodeSeq(state: ActualizationState): number {
  let max = 0;
  for (const st of Object.values(state.legalEntityOverridesByDealerId)) {
    if (!st?.overridesById) continue;
    for (const raw of Object.values(st.overridesById)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const code = String((raw as Record<string, unknown>).internalCode ?? "").trim();
      const m = DISPLAY_CODE_RE.exec(code);
      if (m) max = Math.max(max, parseInt(m[1]!, 10));
    }
  }
  return max;
}

/** Следующий отображаемый код TND-LE-000001 в рамках состояния актуализации пользователя. */
export function allocateNextLegalEntityDisplayCode(state: ActualizationState): string {
  return `TND-LE-${pad6(maxDisplayCodeSeq(state) + 1)}`;
}

export function isLegalEntityArchivedInActualization(act: ActualizationState, dealerId: string, legalEntityId: string): boolean {
  const top = act.archivedLegalEntitiesById[legalEntityId];
  if (top && top.dealerId === dealerId) return true;
  const st = act.legalEntityOverridesByDealerId[dealerId];
  const legacy = st?.archivedById?.[legalEntityId];
  return legacy === true || legacy === "true" || legacy === 1;
}

/** Убрать юрлицо из архива (рабочий список снова покажет запись, если есть данные в overrides / release). */
export function restoreLegalEntityFromArchive(
  state: ActualizationState,
  dealerId: string,
  legalEntityId: string,
): ActualizationState {
  const { [legalEntityId]: _removed, ...restArch } = state.archivedLegalEntitiesById;
  const cur = state.legalEntityOverridesByDealerId[dealerId];
  let nextLegal = state.legalEntityOverridesByDealerId;
  if (cur?.archivedById && cur.archivedById[legalEntityId] != null) {
    const { [legalEntityId]: _l, ...restLegacy } = cur.archivedById;
    nextLegal = {
      ...state.legalEntityOverridesByDealerId,
      [dealerId]: { ...cur, archivedById: restLegacy },
    };
  }
  return mergeActualizationState(state, {
    archivedLegalEntitiesById: restArch,
    legalEntityOverridesByDealerId: nextLegal,
  });
}

export function buildArchivedLegalEntityInfo(params: {
  legalEntityId: string;
  dealerId: string;
  archivedBy: string;
  archivedByName: string;
  source?: ActualizationSource;
}): ArchivedLegalEntityInfo {
  return {
    legalEntityId: params.legalEntityId,
    dealerId: params.dealerId,
    archivedAt: new Date().toISOString(),
    archivedBy: params.archivedBy,
    archivedByName: params.archivedByName,
    source: params.source ?? "manual_actualization",
  };
}
