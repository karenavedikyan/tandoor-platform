import {
  isClientTopTier,
  normalizeClientCategory,
  type ClientCategoryId,
} from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { getDbClientCategoryOverride } from "@/lib/dealer-overrides-runtime";
import { isPrompt113BlobFallbackActive } from "@/lib/dealer-overrides-fallback";

export const NEW_CLIENT_GRACE_DAYS = 90;

function topCategoryFromRaw(raw: string | undefined): ClientCategoryId | null {
  if (!raw) return null;
  const norm = normalizeClientCategory(raw);
  return isClientTopTier(norm) ? norm : null;
}

export function resolveEffectiveClientCategory(
  dealer: { id: string; clientCategory?: ClientCategoryId | string },
  state: ActualizationState | null,
): ClientCategoryId {
  const fromDb = getDbClientCategoryOverride(dealer.id);
  if (fromDb) return fromDb;

  if (isPrompt113BlobFallbackActive()) {
    const overrideRaw = state?.clientCategoryOverridesById?.[dealer.id];
    const fromOverride = topCategoryFromRaw(overrideRaw);
    if (fromOverride) return fromOverride;
  }

  const raw = dealer.clientCategory as ClientCategoryId | undefined;
  if (raw === "top150" || raw === "top350" || raw === "top500" || raw === "top500plus") {
    return raw;
  }
  const fromRow = topCategoryFromRaw(typeof raw === "string" ? raw : undefined);
  if (fromRow) return fromRow;

  const manual = state?.manuallyCreatedDealersById?.[dealer.id];
  if (manual?.createdAt) {
    return "new_client";
  }

  return "new_client";
}

export function isClientWithinNewGrace(
  dealer: { id: string },
  state: ActualizationState | null,
): boolean {
  const manual = state?.manuallyCreatedDealersById?.[dealer.id];
  if (!manual?.createdAt) return false;
  const ageDays = (Date.now() - new Date(manual.createdAt).getTime()) / 86_400_000;
  return ageDays < NEW_CLIENT_GRACE_DAYS;
}

export function daysSinceCreation(
  dealer: { id: string },
  state: ActualizationState | null,
): number | null {
  const manual = state?.manuallyCreatedDealersById?.[dealer.id];
  if (!manual?.createdAt) return null;
  return Math.floor((Date.now() - new Date(manual.createdAt).getTime()) / 86_400_000);
}

export function newClientCategoryTooltip(
  dealer: { id: string },
  state: ActualizationState | null,
): string | null {
  const days = daysSinceCreation(dealer, state);
  if (days == null) return "Категория ТОП ещё не присвоена";
  if (days < NEW_CLIENT_GRACE_DAYS) return `В системе ${days} дн. (до ${NEW_CLIENT_GRACE_DAYS})`;
  return `В системе ${days} дн. — присвойте категорию`;
}
