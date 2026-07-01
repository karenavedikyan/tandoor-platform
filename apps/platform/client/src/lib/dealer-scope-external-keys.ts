/**
 * Ключи клиентов (external_key) из DB scope team/org — общая логика для dealer-base и глобального поиска.
 */

import type { OrgScopePayload, TeamScopePayload } from "@shared/dealers-scope-types";

export function dealerExternalKeysFromTeamScope(ts: TeamScopePayload): Set<string> {
  return new Set(
    ts.members.flatMap((m) => [...m.active_dealer_external_keys, ...m.trashed_dealer_external_keys]),
  );
}

export function dealerExternalKeysFromOrgScope(os: OrgScopePayload): Set<string> {
  const keys = new Set<string>();
  for (const block of os.teams) {
    for (const m of block.members) {
      for (const k of m.active_dealer_external_keys) keys.add(k);
      for (const k of m.trashed_dealer_external_keys) keys.add(k);
    }
  }
  for (const m of os.orphan.members) {
    for (const k of m.active_dealer_external_keys) keys.add(k);
    for (const k of m.trashed_dealer_external_keys) keys.add(k);
  }
  return keys;
}
