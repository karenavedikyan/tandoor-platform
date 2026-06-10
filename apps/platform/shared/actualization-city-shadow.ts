/**
 * Shadow-write города из состояния актуализации в dealer_overrides.city (Промт 278).
 */

import type { ActualizationState } from "../client/src/lib/client-base-actualization-state.js";
import type { PoolLike } from "./admin/admin-auth.js";
import { upsertDealerOverrideCity } from "./dealer-overrides-handlers.js";
import { resolvePersonaCodeToUuid } from "./persona-uuid-mapping.js";

const SYSTEM_ACTOR_UUID = "d43940b0-f52f-413e-8de6-7d62d5dcc8b5";

type DealerOverrideEntry = { fields?: Record<string, unknown> };

function readCity(fields: unknown): string {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return "";
  const city = (fields as Record<string, unknown>).city;
  return String(city ?? "").trim();
}

function resolveActorUuid(actorUserIdRaw: string): string {
  return resolvePersonaCodeToUuid(actorUserIdRaw) ?? SYSTEM_ACTOR_UUID;
}

export async function shadowWriteCitiesFromActualization(
  pool: PoolLike | null | undefined,
  prevState: ActualizationState | Record<string, unknown> | null,
  nextState: ActualizationState | Record<string, unknown>,
  actorUserIdRaw: string,
): Promise<void> {
  if (!pool) return;

  const actorUserId = resolveActorUuid(actorUserIdRaw);
  const prevOverrides = (prevState?.dealerOverridesById ?? {}) as Record<string, DealerOverrideEntry>;
  const nextOverrides = (nextState.dealerOverridesById ?? {}) as Record<string, DealerOverrideEntry>;

  for (const dealerId of Object.keys(nextOverrides)) {
    if (!dealerId.startsWith("client-")) continue;

    const nextCity = readCity(nextOverrides[dealerId]?.fields);
    const prevCity = readCity(prevOverrides[dealerId]?.fields);
    if (nextCity === "" || nextCity === prevCity) continue;

    try {
      await upsertDealerOverrideCity(pool, dealerId, nextCity, actorUserId);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[actualization-shadow-city]", dealerId, m.slice(0, 200));
    }
  }
}
