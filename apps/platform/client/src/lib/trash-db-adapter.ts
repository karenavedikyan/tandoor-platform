import {
  computeTrashExpiresAt,
  type TrashedDealerInfo,
  type TrashedTradePointInfo,
} from "./client-base-actualization-state.js";
import type { DealerOverrideRow } from "../../../shared/dealer-overrides-types";
import type { TradePointOverrideRow } from "../../../shared/trade-point-overrides-types";
import { isEmployeeTrashStatus } from "../../../shared/record-status";

export type TrashDbAdapterDeps = {
  resolveUserName: (userId: string | null | undefined) => string;
};

export function mapDbDealerOverrideToTrashedDealerInfo(
  row: DealerOverrideRow,
  deps: TrashDbAdapterDeps,
): TrashedDealerInfo | null {
  if (!isEmployeeTrashStatus(row.status) || !row.trashed_at) return null;
  const trashedBy = row.trashed_by ?? "";
  return {
    dealerId: row.dealer_id,
    trashedAt: row.trashed_at,
    trashedBy,
    trashedByName: deps.resolveUserName(row.trashed_by) || trashedBy,
    expiresAt: computeTrashExpiresAt(row.trashed_at),
    // TODO(441b): source is not persisted in dealer_overrides; default for UI label only.
    source: "client_card_delete",
    ownerTeamAtTrash: null,
    ownerCode: null,
    snapshot: {
      fullName: row.name,
      city: row.city,
      inn: null,
      dealerCode: null,
      legalEntityName: null,
    },
  };
}

export function mapDbTradePointOverrideToTrashedTradePointInfo(
  row: TradePointOverrideRow,
  deps: TrashDbAdapterDeps,
): TrashedTradePointInfo | null {
  if (!isEmployeeTrashStatus(row.status) || !row.trashed_at || !row.dealer_id) return null;
  const trashedBy = row.trashed_by ?? "";
  return {
    tradePointId: row.tp_id,
    dealerId: row.dealer_id,
    trashedAt: row.trashed_at,
    trashedBy,
    trashedByName: deps.resolveUserName(row.trashed_by) || trashedBy,
    expiresAt: computeTrashExpiresAt(row.trashed_at),
    source: "client_card_delete",
    ownerTeamAtTrash: null,
    ownerCode: null,
    snapshot: {
      name: row.name,
      address: row.address,
      city: row.city,
      tradePointCode: null,
      dealerFullName: null,
    },
  };
}
