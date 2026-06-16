/**
 * Логика сидирования дилеров и ТТ из Release 1 (Промт 348).
 * Используется seed-скриптом и smoke-тестами.
 */

import { deriveReleaseClientCategory, isClientTopTier, type ClientCategoryId } from "../client/src/lib/client-category.js";
import {
  getReleaseClients,
  getReleaseClientTypeLabel,
  type ReleaseClient,
} from "../client/src/lib/release-client-data.js";

export type DealerSeedRow = {
  externalKey: string;
  name: string;
  releaseCode: string | null;
  city: string | null;
  region: string | null;
  clientType: string | null;
  clientCategory: string | null;
  status: string | null;
  format: string | null;
  isActive: boolean;
  isPriority: boolean;
  isClosed: boolean;
  legalEntity: string | null;
  holding: string | null;
  comment: string | null;
  managerName: string | null;
  releaseAddress: string | null;
  clientTypeLabel: string | null;
  releaseTeamId: string | null;
  releaseManagerId: string | null;
  source: string;
};

export type TradePointSeedRow = {
  externalKey: string;
  dealerExternalKey: string;
  name: string;
  city: string | null;
  address: string | null;
  format: string | null;
  isActive: boolean;
  importanceTier: string | null;
  source: string;
};

export type DealerSeedBundle = {
  dealer: DealerSeedRow;
  tradePoints: TradePointSeedRow[];
};

function mapReleaseStatus(c: ReleaseClient): string {
  if (c.isClosed || c.normalizedClientType === "closed") return "приостановлен";
  if (c.normalizedClientType === "potential") return "потенциальный";
  if (c.normalizedClientType === "nonTarget") return "требует внимания";
  return "активный";
}

function deriveImportanceTier(cat: ClientCategoryId): string {
  if (isClientTopTier(cat)) return "vip";
  if (cat === "new_client") return "growth";
  return "standard";
}

/** Стабильный ключ дилера = `DealerRow.id` (совместим с showcase_matrix.dealer_id). */
export function dealerExternalKey(c: ReleaseClient): string {
  return c.id.trim();
}

function buildTradePointSeedRows(c: ReleaseClient, clientCategory: ClientCategoryId): TradePointSeedRow[] {
  const dealerKey = dealerExternalKey(c);
  const city = c.city?.trim() || "—";
  const addr = c.address?.trim() || "";
  const importanceTier = deriveImportanceTier(clientCategory);
  const tpFormat = "Розница / салон";

  const mkTp = (suffix: string, name: string, tpCity: string, tpAddress: string): TradePointSeedRow => ({
    externalKey: `${dealerKey}-${suffix}`,
    dealerExternalKey: dealerKey,
    name,
    city: tpCity,
    address: tpAddress,
    format: tpFormat,
    isActive: c.isActive,
    importanceTier,
    source: "release-seed",
  });

  const parsed = c.parsedTradePoints;
  if (parsed && parsed.length > 0) {
    return parsed.map((tp, idx) => {
      const suf = String(idx + 1).padStart(2, "0");
      const tpCity = (tp.city ?? "").trim() || city;
      const tpAddr = (tp.address ?? "").trim() || `г. ${tpCity}, адрес уточняется`;
      return mkTp(suf, tp.name.trim() || `Торговая точка ${idx + 1}`, tpCity, tpAddr);
    });
  }
  if (!addr) return [];
  return [mkTp("01", `Торговая точка · ${city}`, city, addr)];
}

export function buildDealerSeedBundle(c: ReleaseClient): DealerSeedBundle {
  const rop = c.ropName?.trim() || "—";
  const mgr = c.managerName?.trim() || "—";
  const city = c.city?.trim() || "—";
  const addr = c.address?.trim() || "";
  const typeLabel = c.clientType?.trim() ? c.clientType : getReleaseClientTypeLabel(c.normalizedClientType);
  const clientCategory = deriveReleaseClientCategory({
    clientType: c.clientType,
    normalizedClientType: c.normalizedClientType,
  });
  const status = mapReleaseStatus(c);
  const tradePoints = buildTradePointSeedRows(c, clientCategory);
  const outlets = tradePoints.length;
  const format = outlets > 1 ? "сетевой" : "одиночный";
  const hasProblem = c.normalizedClientType === "nonTarget" || c.isClosed;

  return {
    dealer: {
      externalKey: dealerExternalKey(c),
      name: c.name?.trim() || "Клиент без названия",
      releaseCode: c.code?.trim() || null,
      city,
      region: rop === "—" ? null : rop,
      clientType: c.normalizedClientType,
      clientCategory,
      status,
      format,
      isActive: c.isActive,
      isPriority: c.isPriority,
      isClosed: c.isClosed,
      legalEntity: c.name?.trim() || null,
      holding: "—",
      comment: hasProblem ? `Тип: ${typeLabel}` : "Без критичных отметок в пилотных данных.",
      managerName: mgr === "—" ? null : mgr,
      releaseAddress: addr || null,
      clientTypeLabel: typeLabel,
      releaseTeamId: c.teamId?.trim() || null,
      releaseManagerId: c.managerId?.trim() || null,
      source: "release-seed",
    },
    tradePoints,
  };
}

/** Дедупликация id как в `dedupeDealerIds` (dealer-base-mock-data). */
export function dedupeDealerSeedBundles(bundles: DealerSeedBundle[]): DealerSeedBundle[] {
  const used = new Set<string>();
  for (const bundle of bundles) {
    let id = bundle.dealer.externalKey;
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${bundle.dealer.externalKey}-dup-${n}`)) n += 1;
      id = `${bundle.dealer.externalKey}-dup-${n}`;
      bundle.dealer.externalKey = id;
      bundle.tradePoints = bundle.tradePoints.map((tp, idx) => ({
        ...tp,
        externalKey: `${id}-${String(idx + 1).padStart(2, "0")}`,
        dealerExternalKey: id,
      }));
    }
    used.add(id);
  }
  return bundles;
}

export function buildAllDealerSeedBundles(): DealerSeedBundle[] {
  return dedupeDealerSeedBundles(getReleaseClients().map(buildDealerSeedBundle));
}

export function countExpectedTradePointsFromRelease(): number {
  return buildAllDealerSeedBundles().reduce((sum, b) => sum + b.tradePoints.length, 0);
}
