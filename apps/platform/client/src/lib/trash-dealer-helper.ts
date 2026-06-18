/**
 * Утилиты для отправки клиентов / торговых точек в Корзину (Промт 45 + 46).
 *
 * Все пользовательские пути «удалить клиента / ТТ» должны проходить через эти хелперы —
 * это гарантирует одинаковый snapshot и срок жизни 14 дней. Корзина — отдельная сущность
 * от архива; см. `client-base-actualization-state.ts` (`trashedDealersById` /
 * `trashedTradePointsById`).
 *
 * Дополнительно (Промт 46): UI больше НЕ пишет напрямую в `archivedDealersById` /
 * `archivedTradePointsById` через кнопку «Удалить». Архивные сущности остаются как
 * legacy: restore-кнопки в карточке и фильтр на /dealer-base (тогл «Архив клиентов»)
 * работают по тем же ключам, что и раньше.
 */

import {
  computeTrashExpiresAt,
  type TrashedDealerInfo,
  type TrashedTradePointInfo,
} from "./client-base-actualization-state.js";

export type TrashSource = "client_bulk_delete" | "client_card_delete" | "manual_actualization";

export type TrashActor = { userId: string; userName: string };

export type DealerSnapshotInput = {
  fullName?: string | null;
  city?: string | null;
  inn?: string | null;
  dealerCode?: string | null;
  legalEntityName?: string | null;
};

export function snapshotDealerFromRow(row: DealerSnapshotInput): TrashedDealerInfo["snapshot"] {
  return {
    fullName: row.fullName ?? null,
    city: row.city ?? null,
    inn: row.inn ?? null,
    dealerCode: row.dealerCode ?? null,
    legalEntityName: row.legalEntityName ?? null,
  };
}

export type TradePointSnapshotInput = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  tradePointCode?: string | null;
  dealerFullName?: string | null;
};

export function snapshotTradePointFromRow(row: TradePointSnapshotInput): TrashedTradePointInfo["snapshot"] {
  return {
    name: row.name ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    tradePointCode: row.tradePointCode ?? null,
    dealerFullName: row.dealerFullName ?? null,
  };
}

export function makeTrashedDealerInfo(args: {
  dealerId: string;
  by: TrashActor;
  snapshot: TrashedDealerInfo["snapshot"];
  source: TrashSource;
  ownerTeamAtTrash?: string | null;
  ownerCode?: string | null;
  /** Override now for tests. */
  nowIso?: string;
}): TrashedDealerInfo {
  const trashedAt = args.nowIso ?? new Date().toISOString();
  const ownerCode = args.ownerCode ?? args.snapshot.dealerCode ?? null;
  return {
    dealerId: args.dealerId,
    trashedAt,
    trashedBy: args.by.userId,
    trashedByName: args.by.userName,
    expiresAt: computeTrashExpiresAt(trashedAt),
    source: args.source,
    ownerTeamAtTrash: args.ownerTeamAtTrash ?? null,
    ownerCode,
    snapshot: args.snapshot,
  };
}

export function makeTrashedTradePointInfo(args: {
  tradePointId: string;
  dealerId: string;
  by: TrashActor;
  snapshot: TrashedTradePointInfo["snapshot"];
  source: TrashSource;
  ownerTeamAtTrash?: string | null;
  ownerCode?: string | null;
  nowIso?: string;
}): TrashedTradePointInfo {
  const trashedAt = args.nowIso ?? new Date().toISOString();
  return {
    tradePointId: args.tradePointId,
    dealerId: args.dealerId,
    trashedAt,
    trashedBy: args.by.userId,
    trashedByName: args.by.userName,
    expiresAt: computeTrashExpiresAt(trashedAt),
    source: args.source,
    ownerTeamAtTrash: args.ownerTeamAtTrash ?? null,
    ownerCode: args.ownerCode ?? null,
    snapshot: args.snapshot,
  };
}
