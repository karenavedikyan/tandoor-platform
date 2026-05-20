/**
 * Расчёты по порталам витрины для актуализации (manual TP).
 */

import type { TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";

export type PortalSummary = {
  totalPortals: number | null;
  tandoorTotal: number | null;
  /** Свободно / под конкурентов (если можно оценить из total − Tandoor). */
  freeOrCompetitor: number | null;
  entrancePotential: number | null;
  interiorPotential: number | null;
  needsPrimaryInstall: boolean;
  hasExpansionPotentialComputed: boolean;
};

function nz(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n;
}

export function computePortalSummary(row: TradePointShowcaseActualization | undefined): PortalSummary {
  const empty: PortalSummary = {
    totalPortals: null,
    tandoorTotal: null,
    freeOrCompetitor: null,
    entrancePotential: null,
    interiorPotential: null,
    needsPrimaryInstall: false,
    hasExpansionPotentialComputed: false,
  };
  if (!row) return empty;
  if (row.hasShowcase === false) return empty;

  const total = nz(row.totalPortals);
  const tTotal = nz(row.tandoorTotalPortals);
  const ent = nz(row.entrancePortals);
  const tint = nz(row.interiorPortals);
  const tEnt = nz(row.tandoorEntrancePortals);
  const tInt = nz(row.tandoorInteriorPortals);

  let freeOrCompetitor: number | null = null;
  if (total != null && tTotal != null) freeOrCompetitor = Math.max(0, total - tTotal);

  let entrancePotential: number | null = null;
  if (ent != null && tEnt != null) entrancePotential = Math.max(0, ent - tEnt);

  let interiorPotential: number | null = null;
  if (tint != null && tInt != null) interiorPotential = Math.max(0, tint - tInt);

  const needsPrimaryInstall = Boolean(total != null && total > 0 && (tTotal == null || tTotal === 0));

  let hasExpansionPotentialComputed = false;
  if (total != null && tTotal != null && total > tTotal) hasExpansionPotentialComputed = true;
  if (entrancePotential != null && entrancePotential > 0) hasExpansionPotentialComputed = true;
  if (interiorPotential != null && interiorPotential > 0) hasExpansionPotentialComputed = true;

  return {
    totalPortals: total,
    tandoorTotal: tTotal,
    freeOrCompetitor,
    entrancePotential,
    interiorPotential,
    needsPrimaryInstall,
    hasExpansionPotentialComputed,
  };
}
